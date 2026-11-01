<script setup>
/**
 * 自选单词
 *
 * 用途：从个人词库里挑几个词，指定这次生成必须用上（后端 md/54）。
 *       只列「复习中 / 已掌握」（status=learning / mastered）——`new` 的词后端会判成「不在词库」，放进选项
 *       只会让用户选到必然 422 的词。
 * 用法：<FocusWordsPicker
 *         v-model="draft.focusWords"
 *         :limit="focusLimit"
 *         :invalid="invalidFocusWords"
 *         :disabled="isGenerating"
 *         :enabled="auth.isAuthenticated"
 *       />
 *
 * props:
 *   modelValue — 已选单词（原始大小写）；空数组 = 不指定，请求体不带这个字段
 *   limit      — 本次篇幅允许的上限（focusWordLimit(targetWords)），选满后禁用其余选项
 *   invalid    — /capacity 回报的失效词（选中后被标成「不认识」的），标红并提示移除
 *   disabled   — 生成中禁用
 *   enabled    — 是否允许选词；游客为 false，只提示登录，不发词库请求
 * emits:
 *   update:modelValue — 归一化后的选择（去重、去空白、不超过 limit）
 *
 * 约定：
 *   - 弹窗里的分页 / 搜索 / 状态筛选只影响「可选列表」，不影响已选
 *   - 关掉弹窗不会清空选择：选完直接点「开始生成」是主路径
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Check, X } from 'lucide-vue-next'
import BaseButton from '../../../component/BaseButton.vue'
import BaseInput from '../../../component/BaseInput.vue'
import BaseModal from '../../../component/BaseModal.vue'
import EmptyState from '../../../component/EmptyState.vue'
import PaginationBar from '../../../component/PaginationBar.vue'
import SegmentedControl from '../../../component/SegmentedControl.vue'
import { fetchWords } from '../../../api/words'
import { isFocusWordsFull, normalizeFocusWords } from '../../../unit/focus-words'

const DEBOUNCE_MS = 250
const PAGE_SIZE = 10

const STATUS_OPTIONS = [
  { value: 'learning', label: '复习中' },
  { value: 'mastered', label: '已掌握' },
]
const STATUS_LABELS = { learning: '复习中', mastered: '已掌握' }

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  limit: { type: Number, default: 0 },
  invalid: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  enabled: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const status = ref('learning')
const keyword = ref('')
const page = ref(1)
const rows = ref([])
const total = ref(0)
const loading = ref(false)
const errorMessage = ref('')

let timer = null
let requestSeq = 0

const selected = computed(() => normalizeFocusWords(props.modelValue, { limit: props.limit }))
const selectedKeys = computed(() => new Set(selected.value.map((word) => word.toLowerCase())))
const invalidKeys = computed(
  () => new Set(props.invalid.map((word) => String(word).trim().toLowerCase()).filter(Boolean)),
)
const remaining = computed(() => Math.max(0, props.limit - selected.value.length))
const isFull = computed(() => isFocusWordsFull(selected.value, props.limit))
const canOpen = computed(() => props.enabled && !props.disabled && props.limit > 0)

const rowStateOf = (word) => {
  const key = String(word).toLowerCase()
  if (selectedKeys.value.has(key)) return 'selected'
  return isFull.value ? 'blocked' : 'idle'
}

function commit(next) {
  emit('update:modelValue', normalizeFocusWords(next, { limit: props.limit }))
}

function toggle(word) {
  const key = String(word).toLowerCase()
  if (selectedKeys.value.has(key)) {
    commit(selected.value.filter((item) => item.toLowerCase() !== key))
    return
  }
  // 选满后不再接受新增；已选的仍可移除，避免「满了就动不了」
  if (isFull.value) return
  commit([...selected.value, word])
}

function removeWord(word) {
  const key = String(word).toLowerCase()
  commit(selected.value.filter((item) => item.toLowerCase() !== key))
}

function openPicker() {
  if (!canOpen.value) return
  open.value = true
}

async function load() {
  clearTimeout(timer)
  const seq = (requestSeq += 1)
  loading.value = true
  errorMessage.value = ''

  try {
    const data = await fetchWords({
      q: keyword.value.trim(),
      status: status.value,
      page: page.value,
      pageSize: PAGE_SIZE,
    })
    if (seq !== requestSeq) return

    rows.value = data.items || []
    total.value = data.total || 0
  } catch (error) {
    if (seq !== requestSeq) return

    errorMessage.value = error?.message || '词库加载失败，请稍后重试。'
    rows.value = []
    total.value = 0
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

// 打开弹窗才拉词库：设置页本身不需要这批数据
watch(open, (value) => {
  if (value) load()
})

// 搜索 / 切换状态都回到第一页：留在第 5 页却只剩 1 页，用户会以为搜不到
watch([status, keyword], () => {
  if (!open.value) return
  if (page.value !== 1) {
    page.value = 1
    return
  }
  clearTimeout(timer)
  timer = setTimeout(load, DEBOUNCE_MS)
})

watch(page, () => {
  if (open.value) load()
})

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="focus-row">
    <div class="focus-head">
      <span id="focus-words-label" class="row-label">自选单词</span>
      <span class="row-count">已选 {{ selected.length }} / {{ limit }}</span>
    </div>

    <p v-if="!enabled" class="row-hint">登录后可以从自己的词库指定这次必须用上的词</p>
    <p v-else class="row-hint">可选。选中的词一定会出现在文章里；不选则由系统按词库自动挑选。</p>

    <ul v-if="selected.length" class="chips" aria-labelledby="focus-words-label">
      <li v-for="word in selected" :key="word">
        <span class="chip" :class="{ 'is-invalid': invalidKeys.has(word.toLowerCase()) }">
          {{ word }}
          <button
            type="button"
            class="chip-remove"
            :aria-label="`移除 ${word}`"
            :disabled="disabled"
            @click="removeWord(word)"
          >
            <X :size="12" :stroke-width="2" aria-hidden="true" />
          </button>
        </span>
      </li>
    </ul>

    <div class="focus-actions">
      <BaseButton variant="secondary" size="sm" :disabled="!canOpen" @click="openPicker">
        选择单词
      </BaseButton>
      <span v-if="enabled && remaining === 0 && limit > 0" class="row-hint is-full">
        已选满，移除一个才能再选
      </span>
      <span v-else-if="enabled && limit > 0" class="row-hint">还可选 {{ remaining }} 个</span>
    </div>

    <p v-if="invalid.length" class="invalid-note" role="status">
      有 {{ invalid.length }} 个词不在词库或已标记为「不认识」，生成会被拒绝，请移除：
      {{ invalid.join('、') }}
    </p>

    <BaseModal
      v-model:open="open"
      title="选择必须用上的单词"
      description="只列「复习中」和「已掌握」的词；选中的词会作为本次生成的重点词。"
      :max-width="560"
    >
      <div class="picker-toolbar">
        <SegmentedControl v-model="status" :options="STATUS_OPTIONS" aria-label="按学习状态筛选" />
        <div class="picker-search">
          <BaseInput v-model="keyword" aria-label="搜索单词" placeholder="搜索单词或释义" />
        </div>
      </div>

      <p class="picker-count" role="status">
        已选 {{ selected.length }} / {{ limit }} · 还可选 {{ remaining }} 个
      </p>

      <p v-if="errorMessage" class="picker-error" role="alert">
        {{ errorMessage }}
        <button type="button" class="picker-retry" @click="load">重试</button>
      </p>

      <div v-if="loading" class="picker-loading" aria-live="polite">正在加载词库…</div>

      <ul v-else-if="rows.length" class="picker-list">
        <li v-for="item in rows" :key="item.id">
          <button
            type="button"
            role="checkbox"
            class="picker-item"
            :class="`is-${rowStateOf(item.word)}`"
            :aria-checked="selectedKeys.has(String(item.word).toLowerCase())"
            :disabled="rowStateOf(item.word) === 'blocked'"
            @click="toggle(item.word)"
          >
            <span class="check" aria-hidden="true">
              <Check
                v-if="selectedKeys.has(String(item.word).toLowerCase())"
                :size="14"
                :stroke-width="2.2"
              />
            </span>
            <span class="item-main">
              <span class="item-word">{{ item.word }}</span>
              <span class="item-meaning">{{ item.summary || '—' }}</span>
            </span>
            <span class="item-status">{{ STATUS_LABELS[item.status] || '' }}</span>
          </button>
        </li>
      </ul>

      <EmptyState
        v-else-if="!errorMessage"
        compact
        :title="keyword.trim() ? '没有匹配的单词' : '这个状态还没有单词'"
        :description="
          keyword.trim() ? '换个关键词，或切到另一个学习状态看看。' : '先添加单词，再来指定重点词。'
        "
      />

      <PaginationBar
        v-if="total > PAGE_SIZE"
        v-model:page="page"
        :total="total"
        :page-size="PAGE_SIZE"
      />

      <template #footer>
        <BaseButton @click="open = false">完成</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.focus-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.focus-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.row-label {
  font-family: var(--font-display);
  font-size: 15px;
  line-height: 22px;
  color: var(--color-ink);
}

.row-count {
  color: var(--color-muted);
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
}

.row-hint {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.row-hint.is-full {
  color: var(--color-warning);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 10px;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-ink-2);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.chip.is-invalid {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.chip-remove:hover {
  background: var(--color-line);
}

.chip-remove:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.focus-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.invalid-note {
  color: var(--color-danger);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.picker-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.picker-search {
  flex: 1 1 180px;
  min-width: 140px;
}

.picker-count {
  margin-top: var(--space-2);
  color: var(--color-muted);
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
}

.picker-error {
  margin-top: var(--space-2);
  color: var(--color-danger);
  font-size: var(--text-small);
}

.picker-retry {
  margin-left: var(--space-2);
  padding: 0;
  border: none;
  background: none;
  color: var(--color-danger);
  font-size: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.picker-loading {
  padding: var(--space-6) 0;
  color: var(--color-muted);
  font-size: var(--text-small);
  text-align: center;
}

.picker-list {
  max-height: 46vh;
  margin: var(--space-2) 0 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.picker-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: 8px var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink-2);
  text-align: left;
  cursor: pointer;
}

.picker-item:hover:not(:disabled) {
  background: var(--color-surface);
}

.picker-item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.picker-item.is-blocked {
  cursor: not-allowed;
  opacity: 0.45;
}

.check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border: 1px solid var(--color-line-strong);
  border-radius: var(--radius-sm);
  color: var(--color-bg);
}

.picker-item.is-selected .check {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.item-main {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
}

.item-word {
  color: var(--color-ink);
  font-size: 14px;
  line-height: 22px;
}

.item-meaning {
  overflow: hidden;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-status {
  flex: 0 0 auto;
  color: var(--color-muted);
  font-size: var(--text-caption);
}
</style>
