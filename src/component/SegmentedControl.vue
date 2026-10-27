<script setup>
/**
 * 分段选择器
 *
 * 用途：单选分段控件（状态筛选、题目数量等），选中项带滑动指示器
 * 用法：<SegmentedControl
 *         v-model="count"
 *         :options="[{ value: 3, label: '3 题' }, { value: 5, label: '5 题' }]"
 *         aria-label="题目数量"
 *       />
 *
 * props:
 *   modelValue — v-model 绑定值
 *   options    — [{ value, label, count? }]，count 为可选计数徽标
 *   ariaLabel  — 单选组名称，供读屏识别
 *   disabled
 * emits:
 *   update:modelValue
 */
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], required: true },
  options: { type: Array, required: true },
  ariaLabel: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const rootRef = ref(null)

const activeIndex = computed(() =>
  props.options.findIndex((option) => option.value === props.modelValue),
)

const indicatorStyle = computed(() => {
  const count = props.options.length || 1
  const index = activeIndex.value < 0 ? 0 : activeIndex.value
  return {
    width: `calc((100% - 8px) / ${count})`,
    transform: `translateX(${index * 100}%)`,
  }
})

function select(value) {
  if (props.disabled || value === props.modelValue) return
  emit('update:modelValue', value)
}

function handleKeydown(event) {
  if (props.disabled) return

  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']
  if (!keys.includes(event.key)) return

  event.preventDefault()
  const count = props.options.length
  if (!count) return

  const currentIndex = activeIndex.value < 0 ? 0 : activeIndex.value
  let nextIndex = currentIndex

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
    nextIndex = (currentIndex + 1) % count
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    nextIndex = (currentIndex - 1 + count) % count
  }
  if (event.key === 'Home') nextIndex = 0
  if (event.key === 'End') nextIndex = count - 1

  select(props.options[nextIndex].value)

  const buttons = rootRef.value?.querySelectorAll('[role="radio"]')
  if (buttons && buttons[nextIndex]) buttons[nextIndex].focus()
}
</script>

<template>
  <div
    ref="rootRef"
    class="segmented"
    role="radiogroup"
    :aria-label="ariaLabel || undefined"
    @keydown="handleKeydown"
  >
    <span class="segmented-indicator" :style="indicatorStyle" aria-hidden="true" />
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="segmented-item"
      :class="{ 'is-active': option.value === modelValue }"
      :aria-checked="option.value === modelValue"
      :tabindex="option.value === modelValue ? 0 : -1"
      :disabled="disabled"
      @click="select(option.value)"
    >
      <span>{{ option.label }}</span>
      <span v-if="option.count !== undefined" class="segment-count">{{ option.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.segmented {
  position: relative;
  display: inline-grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  padding: 4px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-pill);
  background: var(--color-bg-deep);
}

.segmented-indicator {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  transition: transform 220ms var(--ease-in-out);
}

.segmented-item {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-pill);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  white-space: nowrap;
  transition: color var(--dur-fast) var(--ease-out);
}

.segmented-item:hover:not(:disabled):not(.is-active) {
  color: var(--color-ink-2);
}

.segmented-item.is-active {
  color: var(--color-ink);
  font-weight: 500;
}

.segmented-item:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.segment-count {
  color: var(--color-muted-2);
  font-size: var(--text-caption);
  font-weight: 400;
}

.segmented-item.is-active .segment-count {
  color: var(--color-accent);
}
</style>
