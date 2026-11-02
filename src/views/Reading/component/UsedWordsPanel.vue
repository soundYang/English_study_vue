<script setup>
/**
 * 本文用到的词面板
 *
 * 用途：展示这篇文章实际用到了用户的哪些词，按后端 `usedWords.kind` 分三层
 *       （重点词 / 目标词 / 顺带复习），供读后回顾（md/56 §15、md/22 第 92 行）。
 * 用法：<UsedWordsPanel :words="reading.usedWords" inline />
 *       <UsedWordsPanel :words="result.usedWords" />
 *
 * 口径：
 *   - 数组已由后端按次数倒序、同次数按字母序排好，**这里不再排序**
 *   - `usedWords` 刻意不带 status / reviewStage（历史文章不该随词库变化），
 *     所以 chip 只显示词形与次数，不查词库、不显示状态
 *   - 老文章回 []，与「没有重点词」表现一致：不渲染
 *
 * props:
 *   words     — [{ word, count, kind }]，kind ∈ focus / target / pool
 *   inline    — 标题行内的胶囊样式（阅读页用），不画边框背景
 *   clickable — chip 可点击查看词性与释义（结果页用）；默认关闭，阅读页行为不变
 */
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import WordDetailPopover from '../../../component/WordDetailPopover.vue'
import { useWordLookup } from '../../../composables/useWordLookup'

const props = defineProps({
  words: { type: Array, default: () => [] },
  inline: { type: Boolean, default: false },
  clickable: { type: Boolean, default: false },
})

const listId = `used-words-${useId()}`
const isOpen = ref(false)

const { lookup, cancel } = useWordLookup()
const detailOpen = ref(false)
const detailAnchor = ref(null)
const activeWord = ref('')
const detail = ref({ word: '', phonetic: null, senses: [], facts: [], state: 'empty', message: '' })
let lookupSeq = 0

const KIND_LABELS = {
  focus: '重点词',
  target: '目标词',
  pool: '顺带复习',
}

const groups = computed(() => {
  const result = { focus: [], target: [], pool: [] }

  props.words.forEach((entry) => {
    const word = String(entry?.word ?? '').trim()
    if (!word) return

    const key = Object.prototype.hasOwnProperty.call(result, entry?.kind) ? entry.kind : 'pool'
    result[key].push({ word, count: Math.max(1, Number(entry?.count) || 1) })
  })

  return result
})

const total = computed(
  () => groups.value.focus.length + groups.value.target.length + groups.value.pool.length,
)

function toggle() {
  // 收起清单时 chip 会被移除，浮层不能继续挂在已消失的锚点上
  if (isOpen.value) closeDetail()
  isOpen.value = !isOpen.value
}

function isActive(word) {
  return props.clickable && detailOpen.value && activeWord.value === word
}

async function openDetail(item, event) {
  if (!props.clickable) return

  // 再次点击当前词 = 关闭
  if (detailOpen.value && activeWord.value === item.word) {
    closeDetail()
    return
  }

  activeWord.value = item.word
  detailAnchor.value = event.currentTarget
  detailOpen.value = true
  detail.value = {
    word: item.word,
    phonetic: null,
    senses: [],
    facts: [],
    state: 'loading',
    message: '',
  }

  const current = (lookupSeq += 1)
  const found = await lookup(item.word)
  if (current !== lookupSeq || !found) return
  detail.value = found
}

function closeDetail() {
  detailOpen.value = false
  activeWord.value = ''
  lookupSeq += 1
  // 关闭后不再需要结果；中止请求也避免组件卸载后回写
  cancel()
}

function onDetailOpen(value) {
  if (value) {
    detailOpen.value = true
    return
  }

  closeDetail()
}

function onPoolToggle(event) {
  // <details> 收起后 chip 仍在 DOM 里但不可见，浮层必须主动关闭
  if (!event.currentTarget.open) closeDetail()
}

watch(() => props.words, closeDetail)

onBeforeUnmount(() => {
  lookupSeq += 1
  cancel()
})
</script>

<template>
  <section v-if="total" class="used-words" :class="{ 'is-inline': inline }">
    <button
      type="button"
      class="used-toggle"
      :aria-controls="listId"
      :aria-expanded="isOpen ? 'true' : 'false'"
      @click="toggle"
    >
      <span class="used-title">本文用到了 {{ total }} 个你的单词</span>
      <span class="used-caret" aria-hidden="true">▾</span>
    </button>

    <div v-if="isOpen" :id="listId" class="used-body">
      <div v-for="key in ['focus', 'target']" :key="key" class="used-group">
        <template v-if="groups[key].length">
          <p class="group-label">{{ KIND_LABELS[key] }}</p>
          <ul class="chips">
            <li v-for="item in groups[key]" :key="`${key}-${item.word}`" class="chip-row">
              <component
                :is="clickable ? 'button' : 'span'"
                :type="clickable ? 'button' : undefined"
                class="chip"
                :class="[`is-${key}`, { 'is-active': isActive(item.word) }]"
                lang="en"
                :aria-label="clickable ? `查看 ${item.word} 的词性与中文释义` : undefined"
                :aria-haspopup="clickable ? 'dialog' : undefined"
                :aria-expanded="clickable ? String(isActive(item.word)) : undefined"
                @click="clickable && openDetail(item, $event)"
              >
                {{ item.word }}
              </component>
              <span class="chip-count" :aria-label="`出现 ${item.count} 次`"
                >×{{ item.count }}</span
              >
            </li>
          </ul>
        </template>
      </div>

      <!-- 池内词是「顺带用上」的，数量可能几十个：再收一层，避免撑开正文 -->
      <details v-if="groups.pool.length" class="pool" @toggle="onPoolToggle">
        <summary class="group-label">顺带复习的 {{ groups.pool.length }} 个词</summary>
        <ul class="chips">
          <li v-for="item in groups.pool" :key="`pool-${item.word}`" class="chip-row">
            <component
              :is="clickable ? 'button' : 'span'"
              :type="clickable ? 'button' : undefined"
              class="chip"
              :class="['is-pool', { 'is-active': isActive(item.word) }]"
              lang="en"
              :aria-label="clickable ? `查看 ${item.word} 的词性与中文释义` : undefined"
              :aria-haspopup="clickable ? 'dialog' : undefined"
              :aria-expanded="clickable ? String(isActive(item.word)) : undefined"
              @click="clickable && openDetail(item, $event)"
            >
              {{ item.word }}
            </component>
            <span class="chip-count" :aria-label="`出现 ${item.count} 次`">×{{ item.count }}</span>
          </li>
        </ul>
      </details>
    </div>

    <WordDetailPopover
      v-if="clickable"
      :open="detailOpen"
      :anchor="detailAnchor"
      :word="detail.word"
      :phonetic="detail.phonetic"
      :senses="detail.senses"
      :facts="detail.facts"
      :loading="detail.state === 'loading'"
      :error="detail.state === 'error' ? detail.message : ''"
      :empty-text="detail.state === 'empty' ? detail.message : ''"
      @update:open="onDetailOpen"
    />
  </section>
</template>

<style scoped>
.used-words {
  margin-top: var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

/* 标题行里的胶囊：不占一整块，和词数排在同一行 */
.used-words.is-inline {
  margin-top: 0;
  border: 0;
  background: none;
}

.used-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 0;
  background: none;
  color: var(--color-muted);
  font: inherit;
  font-size: var(--text-small);
  line-height: var(--leading-small);
  text-align: left;
  cursor: pointer;
}

.used-toggle:hover {
  color: var(--color-ink-2);
}

.used-words.is-inline .used-toggle {
  width: auto;
  padding: 0;
  color: var(--color-accent);
}

.used-caret {
  display: inline-block;
  font-size: 10px;
  transition: transform var(--dur-fast) var(--ease-out);
}

.used-toggle[aria-expanded='true'] .used-caret {
  transform: rotate(180deg);
}

.used-toggle:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.used-body {
  padding: 0 var(--space-4) var(--space-4);
}

/* 展开后的清单在标题行里要自己收成一个盒子，否则会和正文混在一起 */
.used-words.is-inline .used-body {
  margin-top: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.used-group + .used-group,
.pool {
  margin-top: var(--space-3);
}

.group-label {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
}

.chip-row {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
}

.chip {
  padding: 2px 9px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-pill);
  background: var(--color-surface-2);
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

/* chip 从 span 变成 button 后，补回浏览器默认会覆盖的字体与交互样式 */
button.chip {
  font-family: inherit;
  font-weight: inherit;
  cursor: pointer;
  transition:
    border-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}

button.chip:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

button.chip:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.chip.is-active {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface));
}

/* 重点词是用户自己挑的，给一点强调；池内词最弱 */
.chip.is-focus {
  border-color: color-mix(in srgb, var(--color-accent) 45%, var(--color-line));
  background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface));
  color: var(--color-accent);
  font-weight: 500;
}

.chip.is-pool {
  color: var(--color-muted-2);
}

.chip-count {
  color: var(--color-muted-2);
  font-size: 11px;
}

.pool summary {
  cursor: pointer;
}

.pool summary:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
</style>
