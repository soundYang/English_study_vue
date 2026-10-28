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
 *   word     — 单词
 *   phonetic — { uk, us }，两式相同只显示一次
 *   senses   — [{ pos, meaning }]
 *   facts    — [{ label, value }]
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
  const roomRight = window.innerWidth - rect.right - GAP - MARGIN
  const roomLeft = rect.left - GAP - MARGIN

  // 优先右侧，其次左侧；两边都放不下就贴住空间更大的一侧（会盖住卡片）
  let left = rect.right + GAP
  if (roomRight < width) {
    left = roomLeft >= width ? rect.left - GAP - width : MARGIN
    if (roomLeft < width && roomRight > roomLeft) left = window.innerWidth - width - MARGIN
  }

  left = Math.min(Math.max(MARGIN, left), Math.max(MARGIN, window.innerWidth - width - MARGIN))

  let top = rect.top
  top = Math.min(Math.max(MARGIN, top), Math.max(MARGIN, window.innerHeight - height - MARGIN))

  placement.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` }
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
  place()
  panelRef.value?.focus({ preventScroll: true })
  // 首帧量到的可能是字体 / 换行前的尺寸，内容稳定后再校一次
  await nextTick()
  place()
}

function teardown() {
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

        <section v-if="senses.length" class="detail-block">
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
