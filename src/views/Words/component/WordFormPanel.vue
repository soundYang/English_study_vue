<script setup>
/**
 * 添加单词表单
 *
 * 用途：右侧常驻表单，也被小于 1200px 时的“添加单词”弹层复用；
 *       负责本地校验、提交中状态、字段错误与成功后清空输入
 * 用法：<WordFormPanel ref="panelRef" :submit-word="handleAdd" />
 *       <WordFormPanel compact :submit-word="handleAdd" />
 *
 * props:
 *   submitWord — 必填，接收 { word, meaning, status }，返回 { ok, errors?, message? }
 *   compact    — 弹层内使用：隐藏标题与底部插画，去掉外层卡片样式
 * emits:
 *   无；提交结果由 submitWord 返回
 * expose:
 *   focusWord — 把焦点移到英文输入框
 */
import { nextTick, reactive, ref } from 'vue'
import BaseButton from '../../../component/BaseButton.vue'
import BaseInput from '../../../component/BaseInput.vue'
import SegmentedControl from '../../../component/SegmentedControl.vue'
import wordsBook from '../../../assets/images/words-book.png'
import { isValidWordStatus, validateWordInput } from '../../../unit/validators'

const STATUS_OPTIONS = [
  { value: 'new', label: '未学习' },
  { value: 'learning', label: '学习中' },
  { value: 'mastered', label: '已掌握' },
]

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

async function focusWord() {
  await nextTick()
  wordField.value?.focus()
}

async function focusFirstError() {
  await nextTick()
  if (fieldErrors.value.word) wordField.value?.focus()
  else if (fieldErrors.value.meaning) meaningField.value?.focus()
}

async function handleSubmit() {
  if (submitting.value) return

  const { valid, errors, word, meaning } = validateWordInput(form)
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
    const result = await props.submitWord({ word, meaning, status: form.status })

    if (result?.ok) {
      // 保留学习状态，方便连续录入同一类单词
      form.word = ''
      form.meaning = ''
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

    <BaseInput
      ref="wordField"
      v-model="form.word"
      label="英文单词"
      placeholder="请输入英文单词"
      name="word"
      maxlength="45"
      :error="fieldErrors.word"
    />

    <BaseInput
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
      <img :src="wordsBook" alt="" width="1536" height="1024" loading="lazy" />
      <span class="form-art-text">Small steps make big progress.</span>
    </div>
  </form>
</template>

<style scoped>
.word-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
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

.form-art {
  position: relative;
  height: 132px;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--color-bg-deep);
}

.form-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 55%;
}

.form-art::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255, 252, 246, 0) 20%, rgba(255, 252, 246, 0.9) 100%);
  content: '';
}

.form-art-text {
  position: absolute;
  right: var(--space-3);
  bottom: var(--space-2);
  z-index: 1;
  color: var(--color-ink-2);
  font-family: var(--font-display);
  font-size: var(--text-caption);
  font-style: italic;
  line-height: var(--leading-caption);
}

@media (max-width: 767px) {
  .word-form {
    padding: var(--space-5);
  }
}
</style>
