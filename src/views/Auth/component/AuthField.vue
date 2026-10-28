<script setup>
/**
 * 登录 / 注册输入框
 *
 * 用途：图标 + 输入框 + 可选密码显示切换，错误信息通过 aria-describedby 关联。
 *       设计稿只用占位文字表达字段，所以标签放进 sr-only，读屏仍能听到字段名。
 * 用法：<AuthField v-model="form.username" label="用户名" placeholder="用户名" :icon="UserRound" />
 *
 * props:
 *   modelValue  — v-model 绑定值
 *   label       — 读屏标签，必填
 *   type        — text / password；password 时出现显示 / 隐藏按钮
 *   placeholder — 占位文案
 *   icon        — lucide 图标组件
 *   autocomplete / maxlength / inputmode / disabled — 原生属性透传
 *   error       — 错误文案，存在时标红并关联 aria-describedby
 *   name        — 供测试与表单识别用的 name
 * emits:
 *   update:modelValue / blur
 */
import { computed, ref, useId } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, required: true },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
  autocomplete: { type: String, default: 'off' },
  error: { type: String, default: '' },
  name: { type: String, default: '' },
  maxlength: { type: [String, Number], default: undefined },
  inputmode: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'blur'])

const uid = useId()
const inputId = `auth-field-${uid}`
const errorId = `${inputId}-error`
const inputRef = ref(null)
const revealed = ref(false)

const isPassword = computed(() => props.type === 'password')
const actualType = computed(() => (isPassword.value && revealed.value ? 'text' : props.type))
const describedBy = computed(() => (props.error ? errorId : undefined))

function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="auth-field" :class="{ 'has-error': Boolean(error) }">
    <label class="sr-only" :for="inputId">{{ label }}</label>

    <div class="field-control">
      <span v-if="icon" class="field-icon" aria-hidden="true">
        <component :is="icon" :size="18" :stroke-width="1.7" />
      </span>

      <input
        :id="inputId"
        ref="inputRef"
        class="field-input"
        :class="{ 'has-icon': Boolean(icon), 'has-action': isPassword }"
        :type="actualType"
        :value="modelValue"
        :placeholder="placeholder"
        :name="name || undefined"
        :autocomplete="autocomplete"
        :maxlength="maxlength"
        :inputmode="inputmode"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        @input="emit('update:modelValue', $event.target.value)"
        @blur="emit('blur', $event)"
      />

      <button
        v-if="isPassword"
        type="button"
        class="field-reveal"
        :aria-label="revealed ? '隐藏密码' : '显示密码'"
        :aria-pressed="revealed"
        @click="revealed = !revealed"
      >
        <EyeOff v-if="revealed" :size="18" :stroke-width="1.7" aria-hidden="true" />
        <Eye v-else :size="18" :stroke-width="1.7" aria-hidden="true" />
      </button>
    </div>

    <p v-if="error" :id="errorId" class="field-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.auth-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.field-control {
  position: relative;
  display: flex;
  align-items: center;
}

.field-input {
  width: 100%;
  height: 46px;
  padding: 0 16px;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: rgba(255, 253, 247, 0.92);
  color: var(--color-ink);
  font-size: var(--text-body);
  line-height: var(--leading-body);
  transition:
    border-color var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}

.field-input.has-icon {
  padding-left: 44px;
}

.field-input.has-action {
  padding-right: 46px;
}

.field-input::placeholder {
  color: #a5a89b;
}

.field-input:hover:not(:disabled) {
  border-color: var(--color-line-strong);
}

.field-input:focus {
  outline: none;
  border-color: var(--color-primary);
  background: var(--color-surface);
  box-shadow: 0 0 0 3px rgba(47, 80, 59, 0.12);
}

.field-input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.has-error .field-input {
  border-color: var(--color-danger);
}

.has-error .field-input:focus {
  box-shadow: 0 0 0 3px rgba(178, 74, 61, 0.12);
}

.field-icon {
  position: absolute;
  left: 14px;
  display: grid;
  place-items: center;
  color: var(--color-muted);
  pointer-events: none;
}

.field-reveal {
  position: absolute;
  right: 6px;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  transition:
    color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}

.field-reveal:hover {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.field-error {
  color: var(--color-danger);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}
</style>
