<script setup>
/**
 * 批量导入弹窗
 *
 * 用途：粘贴多行单词，或上传 Word / Excel / CSV / 文本 / 图片，先解析预览，
 *       确认后统一走 `POST /api/words/batch` 落库。
 *       粘贴模式每行一个单词，可写「word 释义」；# 或 // 开头的行视为注释。
 *       文件模式只解析不写库，行可编辑 / 删除，超过 200 条时按 200 条分批串行提交。
 * 用法：<WordBatchImport
 *         v-model:open="batchOpen"
 *         :preview-batch="store.previewBatch"
 *         :submit-batch="store.importBatch"
 *         :extract-file="store.extractImportFile"
 *         @imported="handleBatchImported"
 *       />
 *
 * props:
 *   open         — 是否打开（v-model:open）
 *   previewBatch — 必填，接收 { text, status }，返回 { ok, data?, message? }
 *   submitBatch  — 必填，接收 { text, status } 或 { rows, status, onProgress }，返回 { ok, data?, message? }
 *   extractFile  — 必填，接收 File，返回 { ok, data?, message? }
 * emits:
 *   update:open / imported — 导入成功（含部分失败），参数为后端结果
 */
import { computed, ref, watch } from 'vue'
import BaseButton from '../../../component/BaseButton.vue'
import BaseModal from '../../../component/BaseModal.vue'
import SegmentedControl from '../../../component/SegmentedControl.vue'
import {
  firstError,
  IMPORT_MAX_FILE_BYTES,
  validateWordInput,
  WORD_BATCH_MAX,
} from '../../../unit/validators'

const STATUS_OPTIONS = [
  { value: 'new', label: '未学习' },
  { value: 'learning', label: '学习中' },
  { value: 'mastered', label: '已掌握' },
]

const MODE_OPTIONS = [
  { value: 'paste', label: '粘贴文本' },
  { value: 'file', label: '上传文件' },
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

const SOURCE_LABELS = {
  txt: '文本',
  csv: 'CSV',
  docx: 'Word',
  xlsx: 'Excel',
  image: '图片',
}

// accept 只是文件选择器的提示，不参与校验；后端按文件内容判断真实类型
const FILE_ACCEPT = '.docx,.xlsx,.csv,.txt,.md,image/png,image/jpeg,image/webp'
const IMAGE_NOTICE =
  '图片是快速识别模式：只识别英文单词，释义一律为空，请逐条核对拼写与释义；空释义会在导入时尝试从词库补全。'
const PASTE_DESCRIPTION =
  '每行一个单词，行内可写中文释义；# 或 // 开头的行会被忽略，重复词按合并规则处理。'
const FILE_DESCRIPTION =
  '支持 Word、Excel、CSV、TXT 和图片；先解析预览，确认后再导入。图片只识别英文单词。'

const PLACEHOLDER = `每行一个单词，行内可写中文释义：
apple 苹果
banana
# 井号开头的行会被忽略`

const props = defineProps({
  open: { type: Boolean, default: false },
  previewBatch: { type: Function, required: true },
  submitBatch: { type: Function, required: true },
  extractFile: { type: Function, required: true },
})

const emit = defineEmits(['update:open', 'imported'])

const text = ref('')
const mode = ref('paste')
const status = ref('learning')
const preview = ref(null)
const result = ref(null)
const previewing = ref(false)
const importing = ref(false)
const extracting = ref(false)
const dragging = ref(false)
const generalError = ref('')
const fileInput = ref(null)
// { fileName, size, source, stats, truncated, warnings }
const fileMeta = ref(null)
// 每一行保留解析接口给的原始行号，编辑 / 删除后仍能指回文件位置
const fileRows = ref([])
const fileImportProgress = ref({ done: 0, total: 0 })

let rowSeq = 0

const busy = computed(() => previewing.value || importing.value || extracting.value)
const hasText = computed(() => Boolean(text.value.trim()))

const modeModel = computed({
  get: () => mode.value,
  set: (value) => {
    if (busy.value || value === mode.value) return
    mode.value = value
    generalError.value = ''
    result.value = null
  },
})

const statusModel = computed({
  get: () => status.value,
  set: (value) => {
    status.value = value
    invalidatePreview()
  },
})

const fileValidCount = computed(() => fileRows.value.filter((row) => row.valid).length)
const fileInvalidCount = computed(() => fileRows.value.length - fileValidCount.value)
const canImportFile = computed(() => fileRows.value.length > 0)
const fileChunkCount = computed(() => Math.ceil(fileRows.value.length / WORD_BATCH_MAX))
const fileWarnings = computed(() => fileMeta.value?.warnings || [])

const fileSummary = computed(() => {
  if (!fileMeta.value) return ''
  if (!fileRows.value.length) return '没有识别到可导入的单词。'
  return `已读取 ${fileRows.value.length} 条：可导入 ${fileValidCount.value} 条，需处理 ${fileInvalidCount.value} 条。`
})

const fileInfoText = computed(() => {
  if (!fileMeta.value) return ''
  return [
    SOURCE_LABELS[fileMeta.value.source] || fileMeta.value.source,
    formatFileSize(fileMeta.value.size),
  ]
    .filter(Boolean)
    .join(' · ')
})

const truncatedNotice = computed(() => {
  const meta = fileMeta.value
  if (!meta?.truncated) return ''

  const total = Number(meta.stats?.total) || fileRows.value.length
  const remain = Math.max(0, total - fileRows.value.length)
  const remainText = remain > 0 ? `，还有 ${remain} 条未读取` : ''
  return `文件共 ${total} 条，本次只读取了前 ${fileRows.value.length} 条${remainText}；请拆分文件后重新上传。`
})

const fileImportLabel = computed(() => {
  if (!importing.value) return '确认导入'
  if (fileChunkCount.value <= 1) return '导入中…'
  return `导入中 ${fileImportProgress.value.done}/${fileImportProgress.value.total}`
})

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
  mode.value = 'paste'
  status.value = 'learning'
  preview.value = null
  result.value = null
  previewing.value = false
  importing.value = false
  extracting.value = false
  dragging.value = false
  generalError.value = ''
  fileMeta.value = null
  fileRows.value = []
  fileImportProgress.value = { done: 0, total: 0 }
  rowSeq = 0
  if (fileInput.value) fileInput.value.value = ''
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

function chunkErrorLabel(error) {
  const from = Number(error?.start) + 1
  const to = Number(error?.end) + 1
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return '部分条目'
  return `第 ${from}–${to} 条`
}

function formatFileSize(bytes) {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
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

function openFilePicker() {
  if (busy.value) return
  fileInput.value?.click()
}

function handleFileInput(event) {
  const file = event?.target?.files?.[0]
  // 清掉 value，下一次选同一个文件也能触发 change
  if (event?.target) event.target.value = ''
  if (file) extractFile(file)
}

function handleDrop(event) {
  dragging.value = false
  if (busy.value) return

  const files = Array.from(event?.dataTransfer?.files || [])
  if (!files.length) return
  if (files.length > 1) {
    generalError.value = '一次只能上传一个文件，请重新选择。'
    return
  }

  extractFile(files[0])
}

async function extractFile(file) {
  if (!file || busy.value) return

  // 选了新文件就丢掉上一份解析结果，避免「报错说文件太大」却还留着旧文件的行
  generalError.value = ''
  result.value = null
  fileMeta.value = null
  fileRows.value = []

  const size = Number(file.size) || 0
  if (size > IMPORT_MAX_FILE_BYTES) {
    generalError.value = '文件不能超过 5MB，请压缩或拆分后再试。'
    return
  }

  extracting.value = true

  try {
    const response = await props.extractFile(file)

    if (!response?.ok) {
      generalError.value = response?.message || '文件解析失败，请稍后重试。'
      return
    }

    const data = response.data || {}
    fileMeta.value = {
      fileName: data.fileName || file.name || '未命名文件',
      size: Number.isFinite(Number(data.size)) ? Number(data.size) : size,
      source: data.source || '',
      stats: data.stats || {},
      truncated: data.truncated === true,
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
    }
    fileRows.value = (Array.isArray(data.rows) ? data.rows : []).map((row, position) => ({
      uid: `file-row-${(rowSeq += 1)}`,
      index: Number.isInteger(row?.index) ? row.index : position,
      word: String(row?.word ?? ''),
      meaning: String(row?.meaning ?? ''),
      valid: row?.valid !== false,
      reason: row?.reason || '',
    }))
  } catch (caught) {
    generalError.value = caught?.message || '文件解析失败，请稍后重试。'
  } finally {
    extracting.value = false
  }
}

/** 就地编辑后重新校验；不直接改写输入框内容，避免中文输入法组词时被打断 */
function updateFileRow(row) {
  const { valid, errors } = validateWordInput({ word: row.word, meaning: row.meaning })
  row.valid = valid
  row.reason = valid ? '' : firstError(errors).message
  result.value = null
  generalError.value = ''
}

function removeFileRow(row) {
  if (busy.value) return
  fileRows.value = fileRows.value.filter((item) => item.uid !== row.uid)
  result.value = null
  generalError.value = ''
}

async function handleFileImport() {
  if (!canImportFile.value || busy.value) return

  generalError.value = ''
  importing.value = true
  fileImportProgress.value = { done: 0, total: fileChunkCount.value }

  try {
    const response = await props.submitBatch({
      rows: fileRows.value.map((row) => ({
        index: row.index,
        word: row.word,
        meaning: row.meaning,
      })),
      status: status.value,
      onProgress: (done, total) => {
        fileImportProgress.value = { done, total }
      },
    })

    if (!response?.ok) {
      generalError.value = response?.message || '导入失败，请稍后重试。'
      return
    }

    const data = response.data || {}
    result.value = {
      ...data,
      created: data.created || 0,
      updated: data.updated || 0,
      skipped: data.skipped || 0,
      failed: data.failed || 0,
      total: data.total || 0,
      items: Array.isArray(data.items) ? data.items : [],
      skippedItems: Array.isArray(data.skippedItems) ? data.skippedItems : [],
      errors: Array.isArray(data.errors) ? data.errors : [],
      chunkErrors: Array.isArray(data.chunkErrors) ? data.chunkErrors : [],
    }
    emit('imported', result.value)
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
    :description="mode === 'file' ? FILE_DESCRIPTION : PASTE_DESCRIPTION"
    :max-width="640"
    :close-on-backdrop="!busy"
    :close-on-esc="!busy"
    :show-close="!busy"
    sheet-on-mobile
    @update:open="emit('update:open', $event)"
  >
    <div class="batch-form">
      <div class="mode-field">
        <span class="field-label">导入方式</span>
        <SegmentedControl
          v-model="modeModel"
          :options="MODE_OPTIONS"
          aria-label="导入方式"
          :disabled="busy"
        />
      </div>

      <label v-if="mode === 'paste'" class="field">
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

      <template v-else>
        <div class="field">
          <span class="field-label">选择文件</span>
          <div
            class="drop-zone"
            :class="{ 'is-dragging': dragging, 'is-busy': extracting }"
            role="button"
            :tabindex="busy ? -1 : 0"
            :aria-disabled="busy ? 'true' : 'false'"
            @click="openFilePicker"
            @keydown.enter.prevent="openFilePicker"
            @keydown.space.prevent="openFilePicker"
            @dragenter.prevent="dragging = true"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="handleDrop"
          >
            <!-- 隐藏的选择框不进 Tab 循环，由外层 drop-zone 代理点击 -->
            <input
              ref="fileInput"
              class="file-hidden-input"
              type="file"
              :accept="FILE_ACCEPT"
              tabindex="-1"
              aria-hidden="true"
              :disabled="busy"
              @click.stop
              @change="handleFileInput"
            />
            <p class="drop-title">
              {{ extracting ? '正在解析文件…' : '点击选择文件，或拖拽到这里' }}
            </p>
            <p class="drop-hint">
              支持 .docx / .xlsx / .csv / .txt / .md 和 PNG / JPEG / WebP，最大 5MB
            </p>
          </div>

          <div v-if="fileMeta" class="file-meta">
            <span class="file-name">{{ fileMeta.fileName }}</span>
            <span v-if="fileInfoText" class="file-info">{{ fileInfoText }}</span>
            <button type="button" class="file-reset" :disabled="busy" @click="openFilePicker">
              重新选择
            </button>
          </div>
        </div>

        <p v-if="fileMeta?.source === 'image'" class="notice notice-warn">{{ IMAGE_NOTICE }}</p>
        <p v-if="truncatedNotice" class="notice notice-warn">{{ truncatedNotice }}</p>

        <ul v-if="fileWarnings.length" class="warning-list">
          <li
            v-for="warning in fileWarnings"
            :key="`${warning.code}-${warning.message}`"
            class="warning-item"
          >
            <span class="warning-code">{{ warning.code }}</span>
            <span>{{ warning.message }}</span>
          </li>
        </ul>
      </template>

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

      <section v-if="mode === 'paste' && preview" class="preview" aria-live="polite">
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

      <section v-if="mode === 'file' && fileMeta" class="preview" aria-live="polite">
        <h3 class="preview-title">解析结果</h3>
        <p class="preview-summary">{{ fileSummary }}</p>
        <p v-if="fileRows.length > WORD_BATCH_MAX" class="preview-summary">
          共 {{ fileRows.length }} 条，将分 {{ fileChunkCount }} 批导入（每批最多
          {{ WORD_BATCH_MAX }} 条）。
        </p>
        <p v-if="importing && fileChunkCount > 1" class="preview-summary">
          正在导入第 {{ fileImportProgress.done }} / {{ fileImportProgress.total }} 批…
        </p>

        <ul v-if="fileRows.length" class="file-row-list">
          <li
            v-for="row in fileRows"
            :key="row.uid"
            class="file-row"
            :class="{ 'is-invalid': !row.valid }"
          >
            <span class="file-row-index">{{ lineLabel(row.index) }}</span>
            <input
              v-model="row.word"
              class="file-word-input"
              type="text"
              aria-label="单词"
              :disabled="busy"
              @input="updateFileRow(row)"
            />
            <input
              v-model="row.meaning"
              class="file-meaning-input"
              type="text"
              aria-label="释义，可留空"
              :disabled="busy"
              @input="updateFileRow(row)"
            />
            <button
              type="button"
              class="file-row-remove"
              :disabled="busy"
              :aria-label="`删除${lineLabel(row.index)}`"
              @click="removeFileRow(row)"
            >
              删除
            </button>
            <p v-if="!row.valid" class="file-row-reason">{{ row.reason }}</p>
          </li>
        </ul>
        <p v-else class="preview-empty">没有识别到可导入的单词。</p>
      </section>

      <section v-if="result" class="preview" aria-live="polite">
        <h3 class="preview-title">导入结果</h3>
        <p class="preview-summary">{{ resultSummary }}</p>

        <div v-if="result.errors?.length" class="error-block">
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

        <div v-if="result.chunkErrors?.length" class="error-block">
          <p class="error-title">以下批次请求失败：</p>
          <ul class="error-list">
            <li
              v-for="error in result.chunkErrors"
              :key="`${error.start}-${error.code}`"
              class="error-item"
            >
              {{ chunkErrorLabel(error) }}：{{ error.message }}
            </li>
          </ul>
        </div>
      </section>
    </div>

    <template #footer>
      <template v-if="result">
        <BaseButton @click="close">完成</BaseButton>
      </template>
      <template v-else-if="mode === 'paste'">
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
      <template v-else>
        <BaseButton variant="secondary" :disabled="busy" @click="close">取消</BaseButton>
        <BaseButton
          :loading="importing"
          :disabled="!canImportFile || extracting || importing"
          @click="handleFileImport"
        >
          {{ fileImportLabel }}
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
.mode-field,
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

.mode-field :deep(.segmented),
.status-field :deep(.segmented) {
  display: grid;
  width: 100%;
}

.mode-field :deep(.segmented-item),
.status-field :deep(.segmented-item) {
  padding: 0 var(--space-2);
}

.drop-zone {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  padding: var(--space-5) var(--space-4);
  border: 1px dashed var(--color-line-strong);
  border-radius: var(--radius-md);
  background: var(--color-bg-deep);
  cursor: pointer;
  text-align: center;
  transition:
    border-color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}

.drop-zone:hover,
.drop-zone:focus-visible,
.drop-zone.is-dragging {
  border-color: var(--color-primary);
}

.drop-zone:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.drop-zone.is-dragging {
  background: var(--color-surface);
}

.drop-zone.is-busy {
  cursor: progress;
}

.file-hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.drop-title {
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.drop-hint {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.file-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px var(--space-2);
  align-items: baseline;
}

.file-name {
  color: var(--color-ink);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  overflow-wrap: anywhere;
}

.file-info {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.file-reset {
  color: var(--color-accent);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.file-reset:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.notice {
  padding: 8px var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.notice-warn {
  color: var(--color-warning);
  background: var(--color-warning-bg);
}

.warning-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.warning-item {
  display: flex;
  gap: 6px;
  color: var(--color-warning);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  overflow-wrap: anywhere;
}

.warning-code {
  flex: 0 0 auto;
  font-family: var(--font-mono, monospace);
  opacity: 0.75;
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

.file-row-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.file-row {
  display: grid;
  grid-template-areas: 'index word meaning remove';
  grid-template-columns: 64px minmax(0, 1fr) minmax(0, 1.2fr) auto;
  gap: 6px var(--space-2);
  align-items: center;
  padding: 6px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.file-row.is-invalid {
  border-color: var(--color-line-strong);
  background: var(--color-bg-deep);
}

.file-row.is-invalid .file-word-input,
.file-row.is-invalid .file-meaning-input {
  color: var(--color-muted);
}

.file-row-index {
  grid-area: index;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  white-space: nowrap;
}

.file-word-input,
.file-meaning-input {
  width: 100%;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.file-word-input {
  grid-area: word;
  font-family: var(--font-mono, monospace);
}

.file-meaning-input {
  grid-area: meaning;
}

.file-word-input:focus,
.file-meaning-input:focus {
  border-color: var(--color-primary);
}

.file-row-remove {
  grid-area: remove;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  color: var(--color-danger);
  font-size: var(--text-caption);
}

.file-row-remove:hover:not(:disabled) {
  background: var(--color-danger-bg);
}

.file-row-remove:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.file-row-reason {
  grid-column: 2 / -1;
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
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

@media (max-width: 640px) {
  .file-row {
    grid-template-areas:
      'index remove'
      'word word'
      'meaning meaning';
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .file-row-reason {
    grid-column: 1 / -1;
  }
}
</style>
