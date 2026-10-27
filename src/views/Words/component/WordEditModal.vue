<script setup>
/**
 * 编辑单词弹窗
 *
 * 用途：预填单词、释义与学习状态；单词重复时在字段下方提示，保存成功后关闭并通知父级高亮
 * 用法：<WordEditModal v-model:open="editOpen" :word="editingWord" :save-word="handleUpdate" />
 *
 * props:
 *   open     — 是否打开（v-model:open）
 *   word     — 待编辑词汇对象；打开时用于初始化表单
 *   saveWord — 必填，接收 (id, patch)，返回 { ok, item?, errors?, message? }
 * emits:
 *   update:open / saved — 保存成功，参数为更新后的词汇
 */
import { reactive, ref, watch } from 'vue'
import BaseButton from '../../../component/BaseButton.vue'
import BaseInput from '../../../component/BaseInput.vue'
import BaseModal from '../../../component/BaseModal.vue'
import SegmentedControl from '../../../component/SegmentedControl.vue'
import { isValidWordStatus, validateWordInput } from '../../../unit/validators'

const STATUS_OPTIONS = [
  { value: 'new', label: '未学习' },
  { value: 'learning', label: '学习中' },
  { value: 'mastered', label: '已掌握' },
]

const props = defineProps({
  open: { type: Boolean, default: false },
  word: { type: Object, default: null },
  saveWord: { type: Function, required: true },
})

const emit = defineEmits(['update:open', 'saved'])

const form = reactive({
  word: '',
  meaning: '',
  status: 'learning',
})

const fieldErrors = ref({})
const generalError = ref('')
const submitting = ref(false)

function resetForm() {
  form.word = props.word?.word || ''
  form.meaning = props.word?.meaning || ''
  form.status = props.word?.status || 'learning'
  fieldErrors.value = {}
  generalError.value = ''
}

watch(
  () => [props.open, props.word],
  ([open]) => {
    if (open) resetForm()
  },
  { immediate: true },
)

function close() {
  if (submitting.value) return
  emit('update:open', false)
}

async function handleSubmit() {
  if (submitting.value || !props.word) return

  const { valid, errors, word, meaning } = validateWordInput(form)
  fieldErrors.value = errors

  if (!isValidWordStatus(form.status)) {
    fieldErrors.value = { ...errors, status: '请选择学习状态' }
    return
  }
  if (!valid) return

  generalError.value = ''
  submitting.value = true

  try {
    const result = await props.saveWord(props.word.id, {
      word,
      meaning,
      status: form.status,
    })

    if (result?.ok) {
      emit('saved', result.item)
      emit('update:open', false)
      return
    }

    fieldErrors.value = result?.errors || {}
  } catch (caught) {
    generalError.value = caught?.message || '保存失败，请稍后重试。'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    title="编辑单词"
    description="修改后只影响词汇库，历史阅读中的词汇快照保持不变。"
    :max-width="480"
    :close-on-backdrop="!submitting"
    :show-close="!submitting"
    @update:open="emit('update:open', $event)"
  >
    <form id="word-edit-form" class="edit-form" novalidate @submit.prevent="handleSubmit">
      <BaseInput
        v-model="form.word"
        label="英文单词"
        placeholder="请输入英文单词"
        name="word"
        maxlength="45"
        :error="fieldErrors.word"
      />

      <BaseInput
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

      <p v-if="generalError" class="form-error" role="alert">{{ generalError }}</p>
    </form>

    <template #footer>
      <BaseButton variant="secondary" :disabled="submitting" @click="close">取消</BaseButton>
      <BaseButton :loading="submitting" @click="handleSubmit">保存</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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
</style>
