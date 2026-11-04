<script setup>
/**
 * 交卷前单词确认面板
 *
 * 用途：提交阅读前，把本文涉及的单词（用到的词 + 未学词）列出来，
 *       让用户逐行确认「认识 / 不认识」；确认后先改词库状态，再交卷。
 * 用法：<WordCheckPanel v-model:open="checkOpen" :words="checkWords" :submitting="submitting" @submit="submitNow" />
 *
 * props:
 *   open       — 是否打开（配合 v-model:open）
 *   words      — [{ word, meaning? }]，已按词形去重；释义只用于展示
 *   submitting — 交卷请求进行中，面板保持打开并禁用操作
 * emits:
 *   update:open
 *   submit — 状态已按选择保存（或用户选择直接提交），参数 { changed }
 *
 * 口径（md/63 §3）：
 *   · 默认「认识」：已在词库里且不是墓碑（已排除）的词。
 *   · 默认「不认识」：墓碑词、未收录词、非法词。
 *   · 只提交与初始状态不同的行；不改默认行，避免重置整批 nextReviewAt。
 *   · 墓碑勾选「认识」用 restore，不能直接设 learning。
 *   · 未收录词先 POST /words/batch 加入词库（status=learning），词库没有该词时不加入。
 *   · 查询失败不阻断交卷，面板降级为「直接提交」。
 */
import { computed, ref, watch } from 'vue'
import { AlertTriangle, Check, RefreshCw } from 'lucide-vue-next'
import BaseButton from '../../../component/BaseButton.vue'
import BaseModal from '../../../component/BaseModal.vue'
import { batchUpdateWordStatus, batchWords, checkWords } from '../../../api/words'
import { useToast } from '../../../composables/useToast'

const CHECK_CHUNK = 200

// 后端 skipped.reason → 用户能看懂的提示；未知原因原样返回
const SKIP_LABELS = {
  NOT_FOUND: '单词已不存在',
  BASIC_REMOVED: '已排除的词需要通过恢复操作处理',
  NEW_STATE_ONLY_TODAY: '只能改回今天新建的词',
  FUNCTION_WORD_IMMUTABLE: '功能词不能排除',
  BASIC_WORD_READONLY: '基础词只读，不能排除',
}

const props = defineProps({
  open: { type: Boolean, default: false },
  words: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false },
})

const emit = defineEmits(['update:open', 'submit'])

const toast = useToast()
const rows = ref([])
const loading = ref(false)
const loadError = ref('')
const applying = ref(false)
const busy = computed(() => loading.value || applying.value || props.submitting)
const knownCount = computed(() => rows.value.filter((row) => row.known).length)
const changeCount = computed(
  () => rows.value.filter((row) => row.known !== row.initialKnown).length,
)
const canSubmit = computed(() => !busy.value && rows.value.length > 0)

let loadSeq = 0

function allKnown(value) {
  if (busy.value) return
  rows.value = rows.value.map((row) => ({ ...row, known: value }))
}

function toggleRow(row) {
  if (busy.value) return
  row.known = !row.known
}

function summaryOf(entry) {
  return String(entry?.meaning ?? '').trim()
}

function toRow(entry, info) {
  const valid = info?.valid !== false
  const exists = Boolean(info?.exists)
  const tombstone = info?.source === 'basic-removed'
  const dictionaryFound = info?.dictionary?.found !== false
  const initialKnown = valid && exists && !tombstone

  return {
    word: String(entry.word),
    meaning: summaryOf(entry) || info?.dictionary?.summary || '',
    wordId: info?.wordId ?? null,
    status: info?.status ?? null,
    valid,
    exists,
    tombstone,
    dictionaryFound,
    initialKnown,
    known: initialKnown,
    // 勾选后会发生什么：只做文案提示，实际动作在 buildPlan 里按同一口径计算
    note: !valid
      ? '词形无法识别，不会加入词库'
      : !exists && !dictionaryFound
        ? '词库没有这个词，不会加入'
        : tombstone
          ? '当前已排除，勾选后会恢复为复习中'
          : !exists
            ? '不在词库，勾选后会加入词库'
            : '',
    addable: valid && !exists && dictionaryFound,
  }
}

async function loadStatuses() {
  const seq = ++loadSeq
  const list = props.words
  if (!list.length) {
    rows.value = []
    return
  }

  loading.value = true
  loadError.value = ''

  try {
    const infoByWord = new Map()

    for (let start = 0; start < list.length; start += CHECK_CHUNK) {
      const chunk = list.slice(start, start + CHECK_CHUNK)
      const data = await checkWords(chunk.map((entry) => entry.word))
      ;(data.items || []).forEach((item) => {
        infoByWord.set(String(item.word || '').toLowerCase(), item)
      })
    }

    if (seq !== loadSeq) return
    rows.value = list.map((entry) => toRow(entry, infoByWord.get(String(entry.word).toLowerCase())))
  } catch (error) {
    if (seq !== loadSeq) return
    rows.value = []
    loadError.value = error?.error?.message || error?.message || '单词状态查询失败'
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

/**
 * 把「用户改过的行」翻译成接口动作。
 * 返回 null 表示没有需要写的改动，undefined 表示有行被跳过（写进 warnings）。
 */
function buildPlan() {
  const plan = { removeIds: [], restoreIds: [], addWords: [], warnings: [] }

  rows.value.forEach((row) => {
    if (row.known === row.initialKnown) return

    if (!row.valid || (!row.exists && !row.dictionaryFound)) {
      plan.warnings.push(`${row.word}：${row.note}`)
      return
    }

    if (row.known) {
      if (row.tombstone && row.wordId) plan.restoreIds.push(row.wordId)
      else if (!row.exists && row.addable) plan.addWords.push(row.word)
      return
    }

    if (row.exists && row.wordId) plan.removeIds.push(row.wordId)
  })

  return plan
}

function skipMessage(result) {
  const reasons = (result?.skipped || [])
    .map((item) => SKIP_LABELS[item.reason] || item.reason)
    .filter(Boolean)

  return [...new Set(reasons)].join('、')
}

async function confirm() {
  if (!canSubmit.value) return

  const plan = buildPlan()
  const warnings = [...plan.warnings]
  applying.value = true

  try {
    // 先补词：状态批量接口只认 id，未收录词必须拿到 id 后才能改状态
    if (plan.addWords.length) {
      const result = await batchWords({
        words: plan.addWords.map((word) => ({ word, status: 'learning', source: 'dictionary' })),
        onDuplicate: 'auto',
      })
      const failed = (result.failed || 0) + (result.skipped || 0)
      if (failed) warnings.push(`${failed} 个未收录词加入失败`)
    }

    if (plan.removeIds.length) {
      const result = await batchUpdateWordStatus({ ids: plan.removeIds, target: 'removed' })
      const message = skipMessage(result)
      if (message) warnings.push(message)
    }

    if (plan.restoreIds.length) {
      const result = await batchUpdateWordStatus({ ids: plan.restoreIds, target: 'restore' })
      const message = skipMessage(result)
      if (message) warnings.push(message)
    }
  } catch (error) {
    applying.value = false
    toast.error(error?.error?.message || error?.message || '单词状态保存失败，请重试')
    return
  }

  applying.value = false
  if (warnings.length) toast.info(`部分单词未更新：${warnings.join('；')}`)
  emit('submit', { changed: changeCount.value > 0 })
}

function directSubmit() {
  if (busy.value) return
  emit('submit', { changed: false })
}

function retry() {
  loadStatuses()
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      loadSeq += 1
      return
    }
    loadStatuses()
  },
  // 面板挂载时就以 open=true 出现（页面首次挂载），也要查一次
  { immediate: true },
)
</script>

<template>
  <BaseModal
    :open="open"
    title="提交前确认单词"
    description="这些是本文涉及的词。勾选「认识」表示已经掌握，没勾选的会标为「不认识」。"
    :max-width="680"
    :close-on-backdrop="!busy"
    :close-on-esc="!busy"
    :show-close="!busy"
    sheet-on-mobile
    @update:open="emit('update:open', $event)"
  >
    <div v-if="loading" class="check-loading" role="status">
      <span class="loading-bar"></span>
      <span class="loading-bar is-short"></span>
      <p>正在查询这些词在词库里的状态…</p>
    </div>

    <div v-else-if="loadError" class="check-error" role="alert">
      <AlertTriangle :size="18" aria-hidden="true" />
      <div>
        <p class="error-title">单词状态查询失败</p>
        <p class="error-desc">{{ loadError }}。仍可以直接提交，单词状态保持原样。</p>
      </div>
    </div>

    <template v-else>
      <div class="check-tools">
        <span class="check-count">
          认识 {{ knownCount }} / {{ rows.length }}
          <template v-if="changeCount">· 已改 {{ changeCount }} 个</template>
        </span>
        <div class="bulk-actions">
          <button type="button" class="text-button" :disabled="busy" @click="allKnown(true)">
            全选
          </button>
          <button type="button" class="text-button" :disabled="busy" @click="allKnown(false)">
            全不选
          </button>
        </div>
      </div>

      <ul class="word-list">
        <li v-for="row in rows" :key="row.word" class="word-row" :data-word="row.word">
          <label class="row-main">
            <input
              type="checkbox"
              class="row-check"
              :checked="row.known"
              :disabled="busy"
              @change="toggleRow(row)"
            />
            <span class="word-text">{{ row.word }}</span>
            <span v-if="row.meaning" class="word-meaning">{{ row.meaning }}</span>
          </label>
          <span v-if="row.note" class="row-note">{{ row.note }}</span>
        </li>
      </ul>
    </template>

    <template #footer>
      <BaseButton variant="ghost" :disabled="busy" @click="emit('update:open', false)">
        取消
      </BaseButton>
      <BaseButton v-if="loadError" :loading="submitting" @click="directSubmit">
        直接提交
      </BaseButton>
      <BaseButton v-else variant="secondary" :disabled="busy" @click="retry">
        <RefreshCw :size="14" :stroke-width="1.8" aria-hidden="true" />
        重新查询
      </BaseButton>
      <BaseButton
        v-if="!loadError"
        variant="primary"
        :loading="applying || submitting"
        :disabled="!canSubmit"
        @click="confirm"
      >
        <Check :size="14" :stroke-width="2" aria-hidden="true" />
        确认并提交
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.check-loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-2) 0 var(--space-4);
}

.loading-bar {
  display: block;
  height: 14px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--color-bg-deep) 0%,
    var(--color-line) 50%,
    var(--color-bg-deep) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-sweep 1.4s ease-in-out infinite;
}

.loading-bar.is-short {
  width: 62%;
}

.check-loading p {
  margin-top: var(--space-1);
  color: var(--color-muted);
  font-size: var(--text-small);
}

@keyframes skeleton-sweep {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

.check-error {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-warning) 36%, var(--color-line));
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-warning) 8%, var(--color-surface));
  color: var(--color-warning);
}

.error-title {
  color: var(--color-ink);
  font-weight: 600;
}

.error-desc {
  margin-top: 2px;
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.check-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.check-count {
  color: var(--color-muted);
  font-size: var(--text-small);
  font-variant-numeric: tabular-nums;
}

.bulk-actions {
  display: flex;
  gap: var(--space-3);
}

.text-button {
  border: none;
  background: none;
  color: var(--color-primary-ink);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  cursor: pointer;
}

.text-button:hover:not(:disabled) {
  text-decoration: underline;
}

.text-button:disabled {
  color: var(--color-muted);
  cursor: not-allowed;
}

.word-list {
  display: flex;
  flex-direction: column;
  max-height: 46vh;
  padding: 0;
  margin: 0;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow-y: auto;
  list-style: none;
}

.word-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
}

.word-row + .word-row {
  border-top: 1px solid var(--color-line);
}

.row-main {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  min-width: 0;
  cursor: pointer;
}

.row-check {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary-ink);
  cursor: pointer;
}

.word-text {
  color: var(--color-ink);
  font-family: var(--font-reading);
  font-size: var(--text-body);
  line-height: var(--leading-body);
}

.word-meaning {
  overflow: hidden;
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-note {
  flex-shrink: 0;
  max-width: 42%;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  text-align: right;
}

@media (max-width: 767px) {
  .word-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }

  .row-note {
    max-width: none;
    text-align: left;
  }
}
</style>
