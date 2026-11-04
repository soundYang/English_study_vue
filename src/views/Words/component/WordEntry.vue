<script setup>
/**
 * 单词书里的单条词条
 *
 * 用途：翻书与拼贴共用的一条词：单词 / 朗读 / 音标 / 首条释义 / 状态 / 来源 / 收录日期，
 *       右侧三点菜单放编辑与删除。复选框默认透明但保留占位，靠近、聚焦或选中时显示（md/55 §5.2）。
 * 用法：<WordEntry :item="item" :selected="..." @open="..." @edit="..." @remove="..." />
 *
 * props:
 *   item       — WordDto
 *   selected   — 是否已勾选
 *   highlight  — 新增 / 编辑后短暂高亮
 *   active     — 详情纸页当前展示的词，列表里留一道下划线
 *   selectable — 是否显示复选框
 *   masked     — 游客态：遮罩词形，点击去登录
 * emits:
 *   open    — 点单词，参数 item
 *   edit    — 编辑，参数 item
 *   remove  — 删除，参数 item
 *   select  — 勾选，参数 { id, selected }
 *   login   — 游客点击遮罩
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { EllipsisVertical, Pencil, Trash2, Volume2 } from 'lucide-vue-next'
import GuestMask from '../../../component/GuestMask.vue'
import StatusPill from '../../../component/StatusPill.vue'
import { formatDate } from '../../../unit/format'
import { phoneticParts } from '../../../unit/phonetic'
import { canSpeak, speakWord } from '../../../unit/pronounce'

const BANK_LABELS = { high: '高频', mid: '中频' }

const props = defineProps({
  item: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  highlight: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
  selectable: { type: Boolean, default: false },
  masked: { type: Boolean, default: false },
})

const emit = defineEmits(['open', 'edit', 'remove', 'select', 'login'])

const root = ref(null)
const menuOpen = ref(false)
const speakable = canSpeak()

const phonetics = computed(() => phoneticParts(props.item.phonetic))
const firstSense = computed(() => props.item.senses?.[0] || null)
const extraSenseCount = computed(() => Math.max(0, (props.item.senses?.length || 0) - 1))

/**
 * 来源标签：从词库导入的优先显示「词库·高频 / 中频」，
 * 其余回落到原有的「词库 / 手填」。wordBanks 缺省按空数组处理（老数据）。
 */
const sourceLabel = computed(() => {
  const banks = Array.isArray(props.item.wordBanks) ? props.item.wordBanks : []
  if (banks.length) {
    return banks.map((bank) => `词库·${BANK_LABELS[bank] || bank}`).join(' / ')
  }

  if (props.item.source === 'dictionary') return '词库'
  if (props.item.source === 'manual') return '手填'
  if (props.item.source === 'basic-removed') return '基础词'
  return '—'
})

function handleDocumentPointer(event) {
  if (!root.value?.contains(event.target)) menuOpen.value = false
}

watch(menuOpen, (open) => {
  if (open) document.addEventListener('pointerdown', handleDocumentPointer, true)
  else document.removeEventListener('pointerdown', handleDocumentPointer, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointer, true)
})

function open() {
  if (props.masked) {
    emit('login')
    return
  }
  emit('open', props.item)
}

function speak() {
  speakWord(props.item.word)
}

function edit() {
  menuOpen.value = false
  emit('edit', props.item)
}

function remove() {
  menuOpen.value = false
  emit('remove', props.item)
}

function toggleSelect(event) {
  emit('select', { id: props.item.id, selected: event.target.checked })
}
</script>

<template>
  <li
    ref="root"
    class="word-entry"
    :data-entry-id="item.id"
    :class="{
      'is-selected': selected,
      'is-highlight': highlight,
      'is-active': active,
      'is-masked': masked,
    }"
  >
    <label v-if="selectable" class="entry-check" :aria-label="`选择 ${item.word}`">
      <input
        type="checkbox"
        class="row-check"
        :checked="selected"
        :disabled="masked"
        @change="toggleSelect"
      />
    </label>

    <div class="entry-body">
      <div class="entry-main">
        <template v-if="masked">
          <GuestMask width="96px" height="18px" />
          <GuestMask width="120px" height="12px" />
        </template>
        <template v-else>
          <button
            type="button"
            class="entry-word"
            :aria-label="`查看 ${item.word} 的详细信息`"
            @click="open"
          >
            {{ item.word }}
          </button>
          <button
            v-if="speakable"
            type="button"
            class="entry-speak"
            :aria-label="`朗读 ${item.word}`"
            @click.stop="speak"
          >
            <Volume2 :size="14" :stroke-width="1.8" aria-hidden="true" />
          </button>
          <span class="entry-phonetic" :class="{ 'is-empty': !phonetics.length }" lang="en">
            <template v-if="phonetics.length">
              <span v-for="part in phonetics" :key="part.label" class="phonetic-part">
                {{ part.label }} {{ part.value }}
              </span>
            </template>
            <template v-else>—</template>
          </span>
        </template>
      </div>

      <div v-if="!masked" class="entry-sub">
        <span class="entry-sense" :class="{ 'is-empty': !firstSense }">
          <template v-if="firstSense">
            <span v-if="firstSense.pos" class="sense-pos">{{ firstSense.pos }}</span>
            <span class="sense-text">{{ firstSense.meaning || '—' }}</span>
            <span v-if="extraSenseCount" class="sense-more">+{{ extraSenseCount }}</span>
          </template>
          <template v-else>—</template>
        </span>

        <StatusPill kind="status" :value="item.studyState" :stage="item.reviewStage || 0" />

        <span class="entry-source" :class="`is-${item.source}`">{{ sourceLabel }}</span>
        <span class="entry-date">收录 {{ formatDate(item.createdAt) || '—' }}</span>
      </div>
    </div>

    <div v-if="!masked" class="entry-menu">
      <button
        type="button"
        class="menu-trigger"
        :aria-label="`${item.word} 的更多操作`"
        aria-haspopup="menu"
        :aria-expanded="menuOpen ? 'true' : 'false'"
        @click="menuOpen = !menuOpen"
      >
        <EllipsisVertical :size="16" :stroke-width="1.8" aria-hidden="true" />
      </button>

      <div v-if="menuOpen" class="menu-list" role="menu">
        <button type="button" class="menu-item" role="menuitem" @click="edit">
          <Pencil :size="14" :stroke-width="1.8" aria-hidden="true" />
          编辑
        </button>
        <button type="button" class="menu-item is-danger" role="menuitem" @click="remove">
          <Trash2 :size="14" :stroke-width="1.8" aria-hidden="true" />
          删除
        </button>
      </div>
    </div>
  </li>
</template>

<style scoped>
.word-entry {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: 10px var(--space-2) 10px 0;
  border-bottom: 1px solid var(--color-line);
  transition: background-color var(--dur-fast) var(--ease-out);
}

.word-entry:last-child {
  border-bottom: 0;
}

.word-entry:hover {
  background: var(--color-surface-2);
}

.word-entry.is-selected {
  background: var(--color-bg-deep);
}

.word-entry.is-highlight {
  background: var(--color-success-bg);
}

.word-entry.is-active .entry-word {
  color: var(--color-accent);
  text-decoration-color: currentColor;
}

.word-entry.is-masked {
  cursor: pointer;
}

/* 复选框保留宽度，只切换透明度：显示与隐藏之间不发生横向位移 */
.entry-check {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-top: 1px;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease-out);
}

.word-entry:hover .entry-check,
.word-entry:focus-within .entry-check,
.word-entry.is-selected .entry-check {
  opacity: 1;
}

.row-check {
  width: 15px;
  height: 15px;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.entry-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.entry-main {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px var(--space-2);
  min-width: 0;
}

/* 词条用衬线，单词比释义大一档 */
.entry-word {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-ink);
  font-family: var(--font-reading);
  font-size: 17px;
  font-weight: 500;
  line-height: 26px;
  text-align: left;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  overflow-wrap: anywhere;
  cursor: pointer;
  transition:
    color var(--dur-fast) var(--ease-out),
    text-decoration-color var(--dur-fast) var(--ease-out);
}

.entry-word:hover {
  color: var(--color-accent);
  text-decoration-color: currentColor;
}

.entry-speak {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: var(--color-muted);
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.entry-speak:hover {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.entry-phonetic {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px var(--space-2);
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.phonetic-part {
  white-space: nowrap;
}

.entry-sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px var(--space-2);
  min-width: 0;
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.entry-sense {
  color: var(--color-ink-2);
}

.entry-sense.is-empty {
  color: var(--color-muted);
}

.sense-pos {
  margin-right: 4px;
  color: var(--color-accent);
}

.sense-more {
  margin-left: 4px;
  color: var(--color-muted);
}

.entry-source {
  padding: 0 6px;
  border-radius: var(--radius-pill);
  background: var(--color-bg-deep);
  color: var(--color-muted);
  white-space: nowrap;
}

.entry-source.is-dictionary {
  color: var(--color-accent);
}

.entry-date {
  color: var(--color-muted);
  white-space: nowrap;
}

.entry-menu {
  position: relative;
  flex: 0 0 auto;
}

.menu-trigger {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  color: var(--color-muted);
  opacity: 0;
  transition:
    opacity var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}

.menu-trigger.is-standalone {
  opacity: 0.55;
}

.word-entry:hover .menu-trigger,
.menu-trigger:focus-visible,
.menu-trigger[aria-expanded='true'] {
  opacity: 1;
}

.menu-trigger:hover {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.menu-list {
  position: absolute;
  top: 30px;
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  min-width: 110px;
  padding: 4px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  text-align: left;
  white-space: nowrap;
}

.menu-item:hover {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.menu-item.is-danger {
  color: var(--color-danger);
}

.menu-item.is-danger:hover {
  background: var(--color-danger-bg);
}

@media (hover: none) {
  .entry-check,
  .menu-trigger {
    opacity: 0.65;
  }
}
</style>
