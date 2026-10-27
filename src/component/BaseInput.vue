<script setup>
/**
 * 基础输入框
 *
 * 用途：带标签、提示与错误态的文本输入框，错误信息通过 aria-describedby 关联
 * 用法：<BaseInput v-model="keyword" label="英文单词" placeholder="请输入英文单词" :error="errors.word" />
 *
 * props:
 *   modelValue  — v-model 绑定值
 *   label       — 上方标签
 *   id          — 输入框 id，未传时自动生成
 *   type        — 原生 input 类型，默认 text
 *   placeholder — 占位文案
 *   hint        — 辅助说明
 *   error       — 错误文案，存在时覆盖 hint 并标记 aria-invalid
 *   name / autocomplete / maxlength / inputmode — 原生属性透传
 *   disabled / required
 * emits:
 *   update:modelValue / focus / blur
 */
import { computed, ref, useId } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  id: { type: String, default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  name: { type: String, default: '' },
  autocomplete: { type: String, default: 'off' },
  maxlength: { type: [String, Number], default: undefined },
  inputmode: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'focus', 'blur'])

const inputRef = ref(null)
const autoId = useId()
const inputId = computed(() => props.id || `input-${autoId}`)
const describedBy = computed(() => {
  if (props.error) return `${inputId.value}-error`
  if (props.hint) return `${inputId.value}-hint`
  return undefined
})

function handleInput(event) {
  emit('update:modelValue', event.target.value)
}

function handleFocus(event) {
  emit('focus', event)
}

function handleBlur(event) {
  emit('blur', event)
}

/** 供表单在新增成功或校验失败后把焦点移回输入框 */
function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="base-input" :class="{ 'has-error': Boolean(error) }">
    <label v-if="label" class="input-label" :for="inputId">{{ label }}</label>
    <input
      ref="inputRef"
      :id="inputId"
      class="input-control"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :name="name || undefined"
      :autocomplete="autocomplete"
      :maxlength="maxlength"
      :inputmode="inputmode"
      :disabled="disabled"
      :required="required"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
    />
    <p v-if="error" :id="`${inputId}-error`" class="input-message is-error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${inputId}-hint`" class="input-message">{{ hint }}</p>
  </div>
</template>

<style scoped>
.base-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.input-control {
  height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 14px;
  line-height: 22px;
  transition:
    border-color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}

.input-control::placeholder {
  color: var(--color-muted-2);
}

.input-control:hover:not(:disabled) {
  border-color: var(--color-line-strong);
}

.input-control:focus {
  border-color: var(--color-primary);
}

.input-control:disabled {
  background: var(--color-bg-deep);
  cursor: not-allowed;
}

.has-error .input-control {
  border-color: var(--color-danger);
}

.input-message {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.input-message.is-error {
  color: var(--color-danger);
}

@media (max-width: 767px) {
  .input-control {
    font-size: 16px;
  }
}
</style>
