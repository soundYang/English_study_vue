<script setup>
/**
 * 添加单词表单
 *
 * 用途：右侧常驻表单，也被小于 1200px 时的“添加单词”弹层复用；
 *       负责本地校验、词库联想、锁定态、提交中状态与成功后清空输入。
 * 用法：<WordFormPanel ref="panelRef" :submit-word="handleAdd" />
 *       <WordFormPanel compact :submit-word="handleAdd" />
 *
 * 交互见 md/单词词库与自动补全设计方案.md 第 6 节：
 *   开关开 → 输入 ≥2 字符触发联想，选中后进入锁定态，音标/词性/释义只读；
 *   开关关或词库未收录 → 回到手填，保存为 source = 'manual' 的条目。
 *
 * props:
 *   submitWord — 必填，接收完整 payload（dictionary 带快照，manual 带 meaning），
 *                返回 { ok, errors?, message? }
 *   compact    — 弹层内使用：隐藏标题与底部插画，去掉外层卡片样式
 * emits:
 *   无；提交结果由 submitWord 返回
 * expose:
 *   focusWord — 把焦点移到英文输入框
 */
import { computed, nextTick, onBeforeUnmount, reactive, ref, useId, watch } from 'vue'
import BaseButton from '../../../component/BaseButton.vue'
import BaseInput from '../../../component/BaseInput.vue'
import SegmentedControl from '../../../component/SegmentedControl.vue'
import WordSuggestList from './WordSuggestList.vue'
import wordsQuote from '../../../assets/images/words-quote.png'
import { searchDictionary } from '../../../api/dictionary'
import { localStore, storageKeys } from '../../../unit/storage'
import { isValidWordStatus, validateWordInput } from '../../../unit/validators'

const STATUS_OPTIONS = [
  { value: 'new', label: '复习中' },
  { value: 'learning', label: '学习中' },
  { value: 'mastered', label: '已掌握' },
]

const SUGGEST_OPTIONS = [
  { value: 'on', label: '开' },
  { value: 'off', label: '关' },
]

const SEARCH_DEBOUNCE = 300
const SEARCH_MIN_LENGTH = 2

const props = defineProps({
  submitWord: { type: Function, required: true },
  compact: { type: Boolean, default: false },
})

const form = reactive({
  word: '',
  meaning: '',
  status: 'learning',
})

const fieldErrors = ref({})
const generalError = ref('')
const submitting = ref(false)
const wordField = ref(null)
const meaningField = ref(null)

// 开关只记偏好，不进入单词数据；默认开启
const suggestPref = ref(localStore.get(storageKeys.dictionarySuggest, true) ? 'on' : 'off')
const suggestOn = computed(() => suggestPref.value === 'on')

const suggestions = ref([])
const activeIndex = ref(-1)
// idle | loading | ready | empty | failed | dismissed
const searchState = ref('idle')
const lockedEntry = ref(null)

const listId = `word-suggest-${useId()}`

// 防抖与并发控制：只允许最后一次搜索写回结果，切换输入时中止上一次请求
let debounceTimer = null
let controller = null
let searchSeq = 0

const listVisible = computed(
  () =>
    suggestOn.value &&
    !lockedEntry.value &&
    ['loading', 'ready', 'empty', 'failed'].includes(searchState.value),
)

const activeOptionId = computed(() =>
  listVisible.value && activeIndex.value >= 0 ? `${listId}-option-${activeIndex.value}` : undefined,
)

function cancelPendingSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = null
  if (controller) {
    controller.abort()
    controller = null
  }
  searchSeq += 1
}

function resetSuggestions() {
  cancelPendingSearch()
  suggestions.value = []
  activeIndex.value = -1
  searchState.value = 'idle'
}

async function runSearch(keyword) {
  const current = (searchSeq += 1)
  controller?.abort()
  controller = new AbortController()
  searchState.value = 'loading'

  try {
    const result = await searchDictionary(keyword, { signal: controller.signal })
    if (current !== searchSeq) return

    suggestions.value = result?.items || []
    activeIndex.value = suggestions.value.length ? 0 : -1
    searchState.value = suggestions.value.length ? 'ready' : 'empty'
  } catch (error) {
    // 中止属于正常流程，不当作失败处理
    if (current !== searchSeq || error?.name === 'AbortError') return

    suggestions.value = []
    activeIndex.value = -1
    searchState.value = 'failed'
  }
}

watch(
  () => form.word,
  (value) => {
    if (!suggestOn.value || lockedEntry.value) return

    clearTimeout(debounceTimer)
    const keyword = String(value ?? '')
      .trim()
      .toLowerCase()

    if (keyword.length < SEARCH_MIN_LENGTH) {
      resetSuggestions()
      return
    }

    // 防抖期间保留上一次结果，避免列表闪烁
    debounceTimer = setTimeout(() => runSearch(keyword), SEARCH_DEBOUNCE)
  },
)

watch(suggestPref, (value) => {
  localStore.set(storageKeys.dictionarySuggest, value === 'on')
  if (value !== 'off') return

  resetSuggestions()
  // 关闭补全时保留已选词形，方便继续手填
  lockedEntry.value = null
})

onBeforeUnmount(cancelPendingSearch)

async function focusWord() {
  await nextTick()
  wordField.value?.focus()
}

async function focusFirstError() {
  await nextTick()
  if (fieldErrors.value.word || fieldErrors.value.senses) wordField.value?.focus()
  else if (fieldErrors.value.meaning) meaningField.value?.focus()
}

function selectEntry(entry) {
  lockedEntry.value = entry
  form.word = entry.headword
  fieldErrors.value = {}
  resetSuggestions()
}

async function releaseLock() {
  lockedEntry.value = null
  form.word = ''
  resetSuggestions()
  await focusWord()
}

function dismissList() {
  if (!listVisible.value) return
  searchState.value = 'dismissed'
  activeIndex.value = -1
}

function handleWordBlur() {
  dismissList()
}

function moveActive(step) {
  const count = suggestions.value.length
  if (!count) return
  activeIndex.value = (activeIndex.value + step + count) % count
}

function handleWordKeydown(event) {
  if (lockedEntry.value) return

  if (event.key === 'ArrowDown') {
    if (!suggestions.value.length) return
    event.preventDefault()
    if (!listVisible.value) {
      searchState.value = 'ready'
      activeIndex.value = 0
      return
    }
    moveActive(1)
    return
  }

  if (event.key === 'ArrowUp') {
    if (!listVisible.value) return
    event.preventDefault()
    moveActive(-1)
    return
  }

  if (event.key === 'Escape') {
    if (!listVisible.value) return
    event.preventDefault()
    dismissList()
    return
  }

  if (event.key === 'Enter' && listVisible.value && activeIndex.value >= 0) {
    const entry = suggestions.value[activeIndex.value]
    if (!entry) return
    // 阻止默认提交，回车用于确认候选
    event.preventDefault()
    selectEntry(entry)
  }
}

async function handleSubmit() {
  if (submitting.value) return

  const entry = lockedEntry.value
  const { valid, errors, word, meaning } = validateWordInput({
    word: form.word,
    meaning: form.meaning,
    mode: entry ? 'dictionary' : 'manual',
    senses: entry?.senses,
  })
  fieldErrors.value = errors

  if (!isValidWordStatus(form.status)) {
    fieldErrors.value = { ...errors, status: '请选择学习状态' }
    await focusFirstError()
    return
  }

  if (!valid) {
    await focusFirstError()
    return
  }

  generalError.value = ''
  submitting.value = true

  try {
    // 命中词库时整条快照落库；手填时只带一条无词性的释义
    const payload = entry
      ? {
          word: entry.headword,
          status: form.status,
          source: 'dictionary',
          dictionaryId: entry.id,
          phonetic: entry.phonetic,
          senses: entry.senses,
        }
      : {
          word,
          status: form.status,
          source: 'manual',
          meaning,
          senses: meaning ? [{ pos: '', meaning }] : [],
        }

    const result = await props.submitWord(payload)

    if (result?.ok) {
      // 保留学习状态，方便连续录入同一类单词
      form.word = ''
      form.meaning = ''
      lockedEntry.value = null
      resetSuggestions()
      fieldErrors.value = {}
      await focusWord()
      return
    }

    fieldErrors.value = result?.errors || {}
    if (Object.keys(fieldErrors.value).length) await focusFirstError()
  } catch (caught) {
    generalError.value = caught?.message || '保存失败，请稍后重试。'
  } finally {
    submitting.value = false
  }
}

defineExpose({ focusWord })
</script>

<template>
  <form
    class="word-form"
    :class="{ 'is-compact': compact }"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <header v-if="!compact" class="form-head">
      <h2 class="form-title">添加单词</h2>
      <p class="form-desc">新单词会立即加入词汇库，并参与后续阅读生成。</p>
    </header>

    <div class="suggest-toggle">
      <span class="toggle-label">词库补全</span>
      <SegmentedControl
        v-model="suggestPref"
        :options="SUGGEST_OPTIONS"
        aria-label="词库自动补全"
        :disabled="submitting"
      />
      <span class="toggle-hint">{{ suggestOn ? '输入时显示词条候选' : '仅手动录入' }}</span>
    </div>

    <div class="word-field">
      <BaseInput
        ref="wordField"
        v-model="form.word"
        label="英文单词"
        placeholder="请输入英文单词"
        name="word"
        maxlength="45"
        :error="fieldErrors.word"
        :readonly="Boolean(lockedEntry)"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="listVisible ? 'true' : 'false'"
        :aria-controls="listVisible ? listId : undefined"
        :aria-activedescendant="activeOptionId"
        @keydown="handleWordKeydown"
        @blur="handleWordBlur"
      />

      <WordSuggestList
        v-if="listVisible"
        :list-id="listId"
        :items="suggestions"
        :active-index="activeIndex"
        :state="searchState"
        @select="selectEntry"
        @hover="activeIndex = $event"
      />
    </div>

    <!-- 锁定态：音标、词性、释义全部只读，来源是词库 -->
    <div v-if="lockedEntry" class="entry-card" aria-label="来自词库的词条，只读">
      <div class="entry-head">
        <span class="entry-phonetic" lang="en">
          <span>英 {{ lockedEntry.phonetic.uk || '—' }}</span>
          <span
            v-if="lockedEntry.phonetic.us && lockedEntry.phonetic.us !== lockedEntry.phonetic.uk"
          >
            美 {{ lockedEntry.phonetic.us }}
          </span>
        </span>
        <button type="button" class="entry-change" @click="releaseLock">换个词</button>
      </div>

      <ul class="entry-senses">
        <li v-for="(sense, index) in lockedEntry.senses" :key="index" class="entry-sense">
          <span v-if="sense.pos" class="entry-pos">{{ sense.pos }}</span>
          <span class="entry-meaning">{{ sense.meaning }}</span>
        </li>
      </ul>

      <p v-if="fieldErrors.senses" class="entry-error" role="alert">{{ fieldErrors.senses }}</p>
    </div>

    <BaseInput
      v-else
      ref="meaningField"
      v-model="form.meaning"
      label="中文释义"
      placeholder="中文释义（可选）"
      name="meaning"
      maxlength="100"
      :error="fieldErrors.meaning"
    />

    <div class="status-field">
      <span class="status-label">学习状态</span>
      <SegmentedControl
        v-model="form.status"
        :options="STATUS_OPTIONS"
        aria-label="学习状态"
        :disabled="submitting"
      />
      <p v-if="fieldErrors.status" class="status-error" role="alert">{{ fieldErrors.status }}</p>
    </div>

    <p class="form-hint">单词会统一转为小写保存。</p>

    <p v-if="generalError" class="form-error" role="alert">{{ generalError }}</p>

    <BaseButton type="submit" block :loading="submitting">保存</BaseButton>

    <div v-if="!compact" class="form-art">
      <img :src="wordsQuote" alt="" width="1418" height="636" loading="lazy" />
    </div>
  </form>
</template>

<style scoped>
.word-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
  /* 底色比页面底色更深，边框要跟着加一档，否则卡片轮廓会糊进背景 */
  border: 1px solid var(--color-line-strong);
  border-radius: var(--radius-xl);
  background-color: #ede8df;
}

.word-form.is-compact {
  gap: var(--space-4);
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
}

.form-head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-title {
  font-family: var(--font-display);
  font-size: var(--text-card-title);
  line-height: var(--leading-card-title);
  letter-spacing: 0.02em;
}

.form-desc {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

/* 侧栏约 280px 宽，标签 + 开关 + 提示挤一行会把中文折成两行，改为两行铺排 */
.suggest-toggle {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 4px var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px dashed var(--color-line-strong);
}

.toggle-label {
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  white-space: nowrap;
}

.suggest-toggle :deep(.segmented) {
  justify-self: end;
}

.toggle-hint {
  grid-column: 1 / -1;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

/* 下拉列表以输入框为定位基准 */
.word-field {
  position: relative;
}

.entry-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.entry-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.entry-phonetic {
  display: flex;
  gap: var(--space-3);
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.entry-change {
  color: var(--color-accent);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.entry-change:hover {
  text-decoration: underline;
}

.entry-senses {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.entry-sense {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.entry-pos {
  flex: none;
  color: var(--color-accent);
  font-size: var(--text-caption);
}

.entry-meaning {
  color: var(--color-ink-2);
}

.entry-error {
  color: var(--color-danger);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.status-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-label {
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.status-field :deep(.segmented) {
  display: grid;
  width: 100%;
}

.status-field :deep(.segmented-item) {
  padding: 0 var(--space-2);
}

.status-error,
.form-error {
  color: var(--color-danger);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.form-hint {
  margin-top: calc(var(--space-1) * -1);
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

/* 插画自带引语与纸纹，整张铺满即可，不再叠渐变和文字 */
.form-art {
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--color-bg-deep);
}

.form-art img {
  opacity: 0.6;
  display: block;
  width: 100%;
  height: auto;
}

@media (max-width: 767px) {
  .word-form {
    padding: var(--space-5);
  }
}
</style>
