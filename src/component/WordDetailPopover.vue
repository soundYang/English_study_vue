<script setup>
/**
 * 单词详情浮层
 *
 * 用途：在基础词汇卡片 / 我的单词列表旁读一个词的完整数据（全部义项 + 事实行）。
 *       数据由调用方从列表快照里整理好传入，组件只负责定位、关闭行为与排版。
 * 用法：<WordDetailPopover
 *         :open="detailOpen"
 *         :anchor="detailTarget?.anchor || null"
 *         :word="detail.word"
 *         :phonetic="detail.phonetic"
 *         :senses="detail.senses"
 *         :facts="detail.facts"
 *         @update:open="closeDetail"
 *       >
 *         <template #badges><StatusPill ... /></template>
 *       </WordDetailPopover>
 *
 * 行为：
 *   - 桌面贴在锚点右侧，放不下翻左侧，再不行贴边；滚动 / 缩放跟随重算
 *   - ≤639px 改为底部抽屉
 *   - 点外部关闭不抢焦点；Esc 关闭并把焦点还给锚点；锚点被移除时自动关闭
 *
 * props:
 *   open     — 是否打开
 *   anchor   — 定位锚点（通常是触发按钮）；为空时按打开时的视口角落兜底
 *   word      — 单词
 *   phonetic  — { uk, us }，两式相同只显示一次
 *   senses    — [{ pos, meaning }]
 *   facts     — [{ label, value }]
 *   loading   — 释义查询中；释义区显示加载文案
 *   error     — 查询失败文案；优先级高于 emptyText
 *   emptyText — 无释义时的提示；传空字符串则不显示空状态
 * emits:
 *   update:open
 * slots:
 *   badges — 标题右侧的状态胶囊等
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { phoneticParts } from '../unit/phonetic'

const props = defineProps({
  open: { type: Boolean, default: false },
  anchor: { type: Object, default: null },
  word: { type: String, default: '' },
  phonetic: { type: Object, default: null },
  senses: { type: Array, default: () => [] },
  facts: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  emptyText: { type: String, default: '暂无释义' },
})

const emit = defineEmits(['update:open'])

const GAP = 10
const MARGIN = 12
const PANEL_WIDTH = 328
const SHEET_BREAKPOINT = 639

const panelRef = ref(null)
// 先钉在左上角，避免 position: fixed 在算出坐标前按文档流位置闪一帧
const placement = ref({ top: '0px', left: '0px' })
const isSheet = ref(false)
const parts = computed(() => phoneticParts(props.phonetic))

let frame = 0
let resizeObserver = null

function cancelFrame() {
  if (!frame) return
  cancelAnimationFrame(frame)
  frame = 0
}

function place() {
  if (!props.open) return

  const anchor = props.anchor
  if (!anchor || !anchor.isConnected) {
    emit('update:open', false)
    return
  }

  if (window.innerWidth <= SHEET_BREAKPOINT) {
    isSheet.value = true
    placement.value = {}
    return
  }

  isSheet.value = false

  const rect = anchor.getBoundingClientRect()
  const panel = panelRef.value
  const width = panel?.offsetWidth || PANEL_WIDTH
  const height = panel?.offsetHeight || 0
  // max-height 截断后 offsetHeight 只是可见高度；scrollHeight 才是内容真实高度
  // （+2 补上下边框），用它判断放不放得下，避免只靠内部滚动才能看到事实行
  const contentHeight = panel ? Math.max(height, panel.scrollHeight + 2) : height
  const roomRight = window.innerWidth - rect.right - GAP - MARGIN
  const roomLeft = rect.left - GAP - MARGIN

  // 优先右侧，其次左侧；两边都放不下就贴住空间更大的一侧（会盖住卡片）
  let left = rect.right + GAP
  if (roomRight < width) {
    left = roomLeft >= width ? rect.left - GAP - width : MARGIN
    if (roomLeft < width && roomRight > roomLeft) left = window.innerWidth - width - MARGIN
  }

  left = Math.min(Math.max(MARGIN, left), Math.max(MARGIN, window.innerWidth - width - MARGIN))

  const spaceAbove = rect.top - GAP - MARGIN
  const spaceBelow = window.innerHeight - rect.bottom - GAP - MARGIN

  /**
   * 锚点在视口下半区，或下方明显不够时，改为向上展开。
   *
   * 向上展开的坐标只由锚点决定，不依赖浮层当前高度：
   * 释义是异步回来的，浮层会从 loading 的小高度长到大高度，如果按「下方展开 + 事后下移」，
   * 只要有一次没量准（旧版触发过），底部的事实行就会掉出视口。
   * 向上展开后，内容再变高也只会往上延伸，视口底部始终安全。
   */
  const openUpward =
    rect.top >= window.innerHeight / 2 ||
    (contentHeight > 0 && contentHeight > spaceBelow && spaceAbove > spaceBelow)

  if (openUpward) {
    placement.value = {
      top: 'auto',
      bottom: `${Math.round(Math.max(MARGIN, window.innerHeight - rect.top + GAP))}px`,
      left: `${Math.round(left)}px`,
      // 面板底边离锚点上方 GAP，可用高度就是锚点以上的空间
      maxHeight: `${Math.max(0, Math.round(spaceAbove))}px`,
    }
    return
  }

  let top = rect.top
  top = Math.min(
    Math.max(MARGIN, top),
    Math.max(MARGIN, window.innerHeight - contentHeight - MARGIN),
  )
  top = Math.round(top)

  placement.value = {
    top: `${top}px`,
    bottom: 'auto',
    left: `${Math.round(left)}px`,
    // 高度按最终 top 封顶：即便量到的还是加载态的小高度，
    // 后面的内容也只会在浮层内部滚动，底边永远不会越过视口
    maxHeight: `${Math.max(0, window.innerHeight - top - MARGIN)}px`,
  }
}

function schedulePlace() {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    place()
  })
}

function close({ restoreFocus = true } = {}) {
  if (!props.open) return

  const anchor = props.anchor
  emit('update:open', false)

  // 外部点击关闭时不要把焦点拉回触发按钮，避免用户点到哪儿焦点跳到别处
  if (restoreFocus && anchor?.isConnected) anchor.focus({ preventScroll: true })
}

function handlePointerDown(event) {
  if (!props.open) return
  if (panelRef.value?.contains(event.target)) return
  // 点锚点本身由页面的 toggle 负责，这里不抢先关闭再重开
  if (props.anchor?.contains(event.target)) return

  close({ restoreFocus: false })
}

function handleKeydown(event) {
  if (event.key !== 'Escape' || !props.open) return

  event.preventDefault()
  close()
}

async function openPanel() {
  document.addEventListener('pointerdown', handlePointerDown)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', schedulePlace)
  window.addEventListener('scroll', schedulePlace, true)

  await nextTick()
  observePanel()
  place()
  panelRef.value?.focus({ preventScroll: true })
  // 首帧量到的可能是字体 / 换行前的尺寸，内容稳定后再校一次
  await nextTick()
  place()
  // 字体晚到会改变换行和高度；加载完成后补一次定位
  document.fonts?.ready.then(() => {
    if (props.open) schedulePlace()
  })
}

/**
 * 直接盯浮层自身的盒模型。
 *
 * 只监听 props 不够：释义异步返回、字体晚到、状态胶囊换行都会改变高度，
 * 而贴底打开的浮层一旦变高就会向下超出视口。尺寸一变就重新贴边，
 * 不依赖调用方在正确的时机更新某个字段。
 */
function observePanel() {
  if (!panelRef.value || typeof ResizeObserver === 'undefined') return

  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(schedulePlace)
  resizeObserver.observe(panelRef.value)
}

function teardown() {
  resizeObserver?.disconnect()
  resizeObserver = null
  cancelFrame()
  document.removeEventListener('pointerdown', handlePointerDown)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', schedulePlace)
  window.removeEventListener('scroll', schedulePlace, true)
}

watch(
  () => props.open,
  (open) => {
    if (open) openPanel()
    else teardown()
  },
  { immediate: true },
)

// 浮层开着时换了锚点或换了词：重新贴位置
watch(
  () => [props.anchor, props.word],
  async () => {
    if (!props.open) return
    await nextTick()
    place()
  },
)

/**
 * 释义是异步返回的：打开瞬间量到的是 loading 态的小高度，
 * 内容回来后浮层会变高。不重新定位的话，贴底打开的浮层会向下超出视口，
 * 用户只能看到标题和「释义」两个字（结果页「本文用到的词」最容易触发）。
 */
watch(
  () => [props.loading, props.senses, props.facts, props.error, props.emptyText],
  async () => {
    if (!props.open) return
    await nextTick()
    place()
  },
  { deep: true },
)

onBeforeUnmount(teardown)
</script>

<template>
  <Teleport to="body">
    <Transition name="detail-popover">
      <section
        v-if="open"
        ref="panelRef"
        class="detail-popover"
        :class="{ 'is-sheet': isSheet }"
        :style="placement"
        role="dialog"
        aria-modal="false"
        :aria-busy="loading ? 'true' : 'false'"
        :aria-label="`“${word}” 的详细信息`"
        tabindex="-1"
      >
        <header class="detail-head">
          <div class="detail-title-row">
            <h2 class="detail-word">{{ word }}</h2>
            <slot name="badges" />
          </div>

          <p v-if="parts.length" class="detail-phonetic" lang="en">
            <span v-for="part in parts" :key="part.label" class="phonetic-part">
              {{ part.label }} {{ part.value }}
            </span>
          </p>
        </header>

        <section v-if="loading" class="detail-block" role="status">
          <p class="detail-status">正在查询释义…</p>
        </section>

        <section v-else-if="error" class="detail-block" role="alert">
          <p class="detail-status is-error">{{ error }}</p>
        </section>

        <section v-else-if="senses.length" class="detail-block">
          <h3 class="detail-label">释义</h3>
          <ul class="detail-senses">
            <li
              v-for="(sense, index) in senses"
              :key="`${sense.pos}-${index}`"
              class="detail-sense"
            >
              <span v-if="sense.pos" class="sense-pos">{{ sense.pos }}</span>
              <span class="sense-meaning">{{ sense.meaning }}</span>
            </li>
          </ul>
        </section>

        <section v-else-if="emptyText" class="detail-block">
          <p class="detail-status">{{ emptyText }}</p>
        </section>

        <dl v-if="facts.length" class="detail-facts">
          <template v-for="fact in facts" :key="fact.label">
            <dt class="fact-label">{{ fact.label }}</dt>
            <dd class="fact-value">{{ fact.value }}</dd>
          </template>
        </dl>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.detail-popover {
  position: fixed;
  z-index: var(--z-overlay);
  width: 328px;
  max-height: calc(100dvh - 24px);
  padding: var(--space-5);
  overflow-y: auto;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  outline: none;
}

.detail-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.detail-word {
  min-width: 0;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 500;
  line-height: 30px;
  overflow-wrap: anywhere;
}

.detail-phonetic {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: 4px;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.detail-block {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-line);
}

.detail-label {
  color: var(--color-muted);
  font-size: var(--text-caption);
  font-weight: 400;
  line-height: var(--leading-caption);
  letter-spacing: 0.04em;
}

.detail-status {
  margin: var(--space-2) 0 0;
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.detail-status.is-error {
  color: var(--color-danger, var(--color-ink-2));
}

.detail-senses {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
}

.detail-sense {
  display: flex;
  gap: 6px;
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.sense-pos {
  flex: 0 0 auto;
  color: var(--color-accent);
  font-size: var(--text-caption);
  line-height: var(--leading-small);
}

.sense-meaning {
  min-width: 0;
  overflow-wrap: anywhere;
}

.detail-facts {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px var(--space-3);
  margin: var(--space-4) 0 0;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-line);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.fact-label {
  color: var(--color-muted);
}

.fact-value {
  margin: 0;
  color: var(--color-ink-2);
  overflow-wrap: anywhere;
}

.detail-popover-enter-active,
.detail-popover-leave-active {
  transition:
    opacity 140ms var(--ease-out),
    transform 140ms var(--ease-out);
}

.detail-popover-enter-from,
.detail-popover-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* 手机没有「旁边」可用，改成底部抽屉，别把触发它的单词盖住 */
@media (max-width: 639px) {
  .detail-popover.is-sheet {
    top: auto;
    right: 12px;
    bottom: calc(12px + env(safe-area-inset-bottom));
    left: 12px;
    width: auto;
    max-height: 70dvh;
  }
}

@media (prefers-reduced-motion: reduce) {
  .detail-popover-enter-active,
  .detail-popover-leave-active {
    transition: none;
  }
}
</style>
