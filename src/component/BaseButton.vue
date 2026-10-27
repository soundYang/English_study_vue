<script setup>
/**
 * 基础按钮
 *
 * 用途：全站统一按钮样式，覆盖主色、次要、幽灵、危险四种变体与三档尺寸
 * 用法：<BaseButton variant="primary" size="md" :loading="saving" @click="save">保存</BaseButton>
 *       <BaseButton variant="ghost" icon-only aria-label="编辑"><Pencil :size="16" /></BaseButton>
 *
 * props:
 *   variant  — primary / secondary / ghost / danger，默认 primary
 *   size     — sm（32px）/ md（40px）/ lg（44px），默认 md
 *   type     — 原生 button 类型，默认 button
 *   loading  — 加载中：显示旋转图标并禁用点击
 *   disabled — 禁用
 *   block    — 撑满父容器
 *   iconOnly — 正方形图标按钮，需配合 aria-label 使用
 * emits:
 *   click — 非加载、非禁用时触发
 */
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'ghost', 'danger'].includes(value),
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value),
  },
  type: {
    type: String,
    default: 'button',
    validator: (value) => ['button', 'submit', 'reset'].includes(value),
  },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
  iconOnly: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])

const isInactive = computed(() => props.disabled || props.loading)

function handleClick(event) {
  if (isInactive.value) return
  emit('click', event)
}
</script>

<template>
  <button
    :type="type"
    class="base-button"
    :class="[`is-${variant}`, `size-${size}`, { 'is-block': block, 'is-icon': iconOnly }]"
    :disabled="isInactive"
    :aria-busy="loading || undefined"
    @click="handleClick"
  >
    <Loader2 v-if="loading" class="spinner" :size="16" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--text-small);
  font-weight: 500;
  line-height: var(--leading-small);
  white-space: nowrap;
  transition:
    background-color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out),
    transform var(--dur-instant) var(--ease-out);
}

.base-button:active:not(:disabled) {
  transform: scale(0.98);
}

.base-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.base-button[aria-busy='true'] {
  cursor: progress;
  opacity: 1;
}

.size-sm {
  height: 32px;
  padding: 0 var(--space-3);
}

.size-md {
  height: 40px;
  padding: 0 var(--space-4);
}

.size-lg {
  height: 44px;
  padding: 0 var(--space-5);
  font-size: var(--text-body);
}

.is-icon.size-sm {
  width: 32px;
  padding: 0;
}

.is-icon.size-md {
  width: 40px;
  padding: 0;
}

.is-icon.size-lg {
  width: 44px;
  padding: 0;
}

.is-block {
  display: flex;
  width: 100%;
}

.is-primary {
  background: var(--color-primary);
  color: var(--color-primary-ink);
}

.is-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.is-secondary {
  border-color: var(--color-line);
  background: var(--color-surface);
  color: var(--color-ink-2);
}

.is-secondary:hover:not(:disabled) {
  border-color: var(--color-line-strong);
  background: var(--color-surface-2);
  color: var(--color-ink);
}

.is-ghost {
  color: var(--color-ink-2);
}

.is-ghost:hover:not(:disabled) {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.is-danger {
  background: var(--color-danger);
  color: var(--color-danger-ink);
}

.is-danger:hover:not(:disabled) {
  background: var(--color-danger-hover);
}

.spinner {
  animation: button-spin 0.8s linear infinite;
}

@keyframes button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
