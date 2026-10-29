<script setup>
/**
 * 批量导入弹窗
 *
 * 用途：粘贴多行单词，先预览「将新增 / 更新 / 跳过 / 无法导入」再确认落库。
 *       每行一个单词，可写「word 释义」；# 或 // 开头的行视为注释。
 *       批量接口逐条返回结果，单条失败不影响其他条。
 * 用法：<WordBatchImport
 *         v-model:open="batchOpen"
 *         :preview-batch="store.previewBatch"
 *         :submit-batch="store.importBatch"
 *         @imported="handleBatchImported"
 *       />
 *
 * props:
 *   open         — 是否打开（v-model:open）
 *   previewBatch — 必填，接收 { text, status }，返回 { ok, data?, message? }
 *   submitBatch  — 必填，接收 { text, status }，返回 { ok, data?, message? }
 * emits:
 *   update:open / imported — 导入成功（含部分失败），参数为后端结果
 */
import { computed, ref, watch } from 'vue'
import BaseButton from '../../../component/BaseButton.vue'
import BaseModal from '../../../component/BaseModal.vue'
import SegmentedControl from '../../../component/SegmentedControl.vue'

const STATUS_OPTIONS = [
  { value: 'new', label: '未学习' },
  { value: 'learning', label: '学习中' },
  { value: 'mastered', label: '已掌握' },
]

const ACTION_LABELS = {
  create: '新增',
  created: '新增',
  updated: '更新',
  reactivated: '恢复',
  enriched: '补全',
  kept: '不变',
  invalid: '无效',
}

const PLACEHOLDER = `每行一个单词，行内可写中文释义：
apple 苹果
banana
# 井号开头的行会被忽略`

const props = defineProps({
  open: { type: Boolean, default: false },
  previewBatch: { type: Function, required: true },
  submitBatch: { type: Function, required: true },
})

const emit = defineEmits(['update:open', 'imported'])

const text = ref('')
const status = ref('learning')
const preview = ref(null)
const statusModel = computed({
  get: () => status.value,
  set: (value) => {
    status.value = value
    invalidatePreview()
  },
})
const result = ref(null)
const previewing = ref(false)
const importing = ref(false)
const generalError = ref('')

const busy = computed(() => previewing.value || importing.value)
const hasText = computed(() => Boolean(text.value.trim()))

const previewSummary = computed(() => {
  if (!preview.value) return ''
  return [
    `将新增 ${preview.value.wouldCreate} 个`,
    `更新 ${preview.value.wouldUpdate} 个`,
    `跳过 ${preview.value.wouldSkip} 个`,
  ].join('，')
})

const resultSummary = computed(() => {
  if (!result.value) return ''
  return [
    `新增 ${result.value.created} 个`,
    `更新 ${result.value.updated} 个`,
    `跳过 ${result.value.skipped} 个`,
    `失败 ${result.value.failed} 个`,
  ].join('，')
})

function reset() {
  text.value = ''
  status.value = 'learning'
  preview.value = null
  result.value = null
  previewing.value = false
  importing.value = false
  generalError.value = ''
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)

function actionLabel(action) {
  return ACTION_LABELS[action] || action || '处理'
}

function lineLabel(index) {
  return `第 ${Number(index) + 1} 行`
}

/** 输入或状态变化后，旧预览不再可信，必须重新预览才能导入 */
function invalidatePreview() {
  preview.value = null
  result.value = null
  generalError.value = ''
}

async function handlePreview() {
  if (!hasText.value || busy.value) return

  generalError.value = ''
  result.value = null
  previewing.value = true

  try {
    const response = await props.previewBatch({ text: text.value, status: status.value })

    if (!response?.ok) {
      generalError.value = response?.message || '预览失败，请稍后重试。'
      return
    }

    preview.value = response.data
  } catch (caught) {
    generalError.value = caught?.message || '预览失败，请稍后重试。'
  } finally {
    previewing.value = false
  }
}

async function handleImport() {
  if (!preview.value || busy.value) return

  generalError.value = ''
  importing.value = true

  try {
    const response = await props.submitBatch({ text: text.value, status: status.value })

    if (!response?.ok) {
      generalError.value = response?.message || '导入失败，请稍后重试。'
      return
    }

    result.value = response.data
    preview.value = null
    emit('imported', response.data)
  } catch (caught) {
    generalError.value = caught?.message || '导入失败，请稍后重试。'
  } finally {
    importing.value = false
  }
}

function close() {
  if (busy.value) return
  emit('update:open', false)
}
</script>

<template>
  <BaseModal
    :open="open"
    title="批量导入"
    description="每行一个单词，行内可写中文释义；# 或 // 开头的行会被忽略，重复词按合并规则处理。"
    :max-width="640"
    :close-on-backdrop="!busy"
    :close-on-esc="!busy"
    :show-close="!busy"
    sheet-on-mobile
    @update:open="emit('update:open', $event)"
  >
    <div class="batch-form">
      <label class="field">
        <span class="field-label">单词列表</span>
        <textarea
          v-model="text"
          class="batch-textarea"
          rows="8"
          :placeholder="PLACEHOLDER"
          maxlength="32768"
          :disabled="busy"
          @input="invalidatePreview"
        />
      </label>

      <div class="status-field">
        <span class="field-label">导入后的学习状态</span>
        <SegmentedControl
          v-model="statusModel"
          :options="STATUS_OPTIONS"
          aria-label="导入后的学习状态"
          :disabled="busy"
        />
      </div>

      <p v-if="generalError" class="form-error" role="alert">{{ generalError }}</p>

      <section v-if="preview" class="preview" aria-live="polite">
        <h3 class="preview-title">预览</h3>
        <p class="preview-summary">{{ previewSummary }}</p>

        <ul v-if="preview.preview.length" class="preview-list">
          <li v-for="item in preview.preview" :key="item.word" class="preview-item">
            <span class="preview-word" lang="en">{{ item.word }}</span>
            <span class="preview-action">{{ actionLabel(item.action) }}</span>
            <span class="preview-meaning">{{ item.summary || '—' }}</span>
          </li>
        </ul>

        <div v-if="preview.errors.length" class="error-block">
          <p class="error-title">以下 {{ preview.errors.length }} 条无法导入：</p>
          <ul class="error-list">
            <li
              v-for="error in preview.errors"
              :key="`${error.index}-${error.word}`"
              class="error-item"
            >
              {{ lineLabel(error.index) }} · {{ error.word || '空行' }}：{{ error.message }}
            </li>
          </ul>
        </div>

        <p v-else-if="!preview.preview.length" class="preview-empty">没有可导入的单词。</p>
      </section>

      <section v-if="result" class="preview" aria-live="polite">
        <h3 class="preview-title">导入结果</h3>
        <p class="preview-summary">{{ resultSummary }}</p>

        <div v-if="result.errors.length" class="error-block">
          <p class="error-title">以下 {{ result.errors.length }} 条未导入：</p>
          <ul class="error-list">
            <li
              v-for="error in result.errors"
              :key="`${error.index}-${error.word}`"
              class="error-item"
            >
              {{ lineLabel(error.index) }} · {{ error.word || '空行' }}：{{ error.message }}
            </li>
          </ul>
        </div>
      </section>
    </div>

    <template #footer>
      <template v-if="result">
        <BaseButton @click="close">完成</BaseButton>
      </template>
      <template v-else>
        <BaseButton variant="secondary" :disabled="busy" @click="close">取消</BaseButton>
        <BaseButton
          variant="secondary"
          :loading="previewing"
          :disabled="!hasText || importing"
          @click="handlePreview"
        >
          预览
        </BaseButton>
        <BaseButton :loading="importing" :disabled="!preview || previewing" @click="handleImport">
          确认导入
        </BaseButton>
      </template>
    </template>
  </BaseModal>
</template>

<style scoped>
.batch-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.field,
.status-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.batch-textarea {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: var(--font-mono, monospace);
  font-size: 14px;
  line-height: 1.7;
  resize: vertical;
  transition: border-color var(--dur-fast) var(--ease-out);
}

.batch-textarea::placeholder {
  color: var(--color-muted);
}

.batch-textarea:hover {
  border-color: var(--color-line-strong);
}

.batch-textarea:focus {
  border-color: var(--color-primary);
}

.status-field :deep(.segmented) {
  display: grid;
  width: 100%;
}

.status-field :deep(.segmented-item) {
  padding: 0 var(--space-2);
}

.form-error {
  color: var(--color-danger);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-bg-deep);
}

.preview-title {
  font-family: var(--font-display);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.preview-summary {
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.preview-list,
.error-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 180px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.preview-item {
  display: grid;
  grid-template-columns: minmax(72px, auto) 48px minmax(0, 1fr);
  align-items: baseline;
  gap: var(--space-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.preview-word {
  color: var(--color-ink);
  font-weight: 500;
  overflow-wrap: anywhere;
}

.preview-action {
  color: var(--color-accent);
  font-size: var(--text-caption);
}

.preview-meaning {
  color: var(--color-muted);
  overflow-wrap: anywhere;
}

.error-title {
  color: var(--color-danger);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.error-item {
  color: var(--color-danger);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  overflow-wrap: anywhere;
}

.preview-empty {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}
</style>
