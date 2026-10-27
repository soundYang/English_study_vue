<script setup>
/**
 * 下拉选择
 *
 * 用途：单选下拉（历史记录难度筛选等），支持点击外部关闭与键盘操作
 * 用法：<DropdownSelect
 *         v-model="level"
 *         :options="[{ value: '', label: '全部难度' }, { value: 'easy', label: '简单' }]"
 *         aria-label="按难度筛选"
 *       />
 *
 * props:
 *   modelValue  — v-model 绑定值
 *   options     — [{ value, label }]
 *   ariaLabel   — 触发器无障碍名称，默认“选择”
 *   placeholder — 未选中时的文案
 *   align       — 菜单对齐方向 start / end，默认 start
 *   disabled
 * emits:
 *   update:modelValue
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, required: true },
  ariaLabel: { type: String, default: '选择' },
  placeholder: { type: String, default: '请选择' },
  align: {
    type: String,
    default: 'start',
    validator: (value) => ['start', 'end'].includes(value),
  },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const rootRef = ref(null)
const isOpen = ref(false)
const activeIndex = ref(-1)

const selectedLabel = computed(() => {
  const option = props.options.find((item) => item.value === props.modelValue)
  return option ? option.label : props.placeholder
})

function focusTrigger() {
  nextTick(() => rootRef.value?.querySelector('.dropdown-trigger')?.focus())
}

function focusActive() {
  const options = rootRef.value?.querySelectorAll('[role="option"]')
  if (options && options[activeIndex.value]) options[activeIndex.value].focus()
}

async function open() {
  if (props.disabled || isOpen.value) return
  isOpen.value = true
  const selectedIndex = props.options.findIndex((item) => item.value === props.modelValue)
  activeIndex.value = selectedIndex >= 0 ? selectedIndex : 0
  await nextTick()
  focusActive()
}

function close({ restoreFocus = true } = {}) {
  if (!isOpen.value) return
  isOpen.value = false
  activeIndex.value = -1
  if (restoreFocus) focusTrigger()
}

function toggle() {
  if (isOpen.value) close()
  else open()
}

function select(option) {
  emit('update:modelValue', option.value)
  close()
}

function moveActive(step) {
  const count = props.options.length
  if (!count) return
  activeIndex.value = (activeIndex.value + step + count) % count
  focusActive()
}

function handleTriggerKeydown(event) {
  if (props.disabled) return

  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    open()
  }
}

function handleListKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }

  if (event.key === 'Tab') {
    close({ restoreFocus: false })
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveActive(1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveActive(-1)
    return
  }

  if (event.key === 'Home') {
    event.preventDefault()
    activeIndex.value = 0
    focusActive()
    return
  }

  if (event.key === 'End') {
    event.preventDefault()
    activeIndex.value = props.options.length - 1
    focusActive()
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    const option = props.options[activeIndex.value]
    if (option) select(option)
  }
}

function handleOutside(event) {
  if (!isOpen.value) return
  if (rootRef.value && !rootRef.value.contains(event.target)) close({ restoreFocus: false })
}

onMounted(() => document.addEventListener('mousedown', handleOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', handleOutside))
</script>

<template>
  <div ref="rootRef" class="dropdown" :class="{ 'is-open': isOpen }">
    <button
      type="button"
      class="dropdown-trigger"
      :aria-label="ariaLabel"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :disabled="disabled"
      @click="toggle"
      @keydown="handleTriggerKeydown"
    >
      <span class="dropdown-label">{{ selectedLabel }}</span>
      <ChevronDown class="dropdown-chevron" :size="16" :stroke-width="1.8" aria-hidden="true" />
    </button>

    <Transition name="dropdown">
      <ul
        v-if="isOpen"
        class="dropdown-menu"
        :class="`align-${align}`"
        role="listbox"
        :aria-label="ariaLabel"
        @keydown="handleListKeydown"
      >
        <li v-for="option in options" :key="option.value" role="none">
          <button
            type="button"
            class="dropdown-option"
            :class="{ 'is-selected': option.value === modelValue }"
            role="option"
            :aria-selected="option.value === modelValue"
            tabindex="-1"
            @click="select(option)"
          >
            <span>{{ option.label }}</span>
            <Check
              v-if="option.value === modelValue"
              :size="14"
              :stroke-width="2"
              aria-hidden="true"
            />
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.dropdown {
  position: relative;
  display: inline-block;
}

.dropdown-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 160px;
  height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  transition:
    border-color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}

.dropdown-trigger:hover:not(:disabled) {
  border-color: var(--color-line-strong);
}

.dropdown-trigger[aria-expanded='true'] {
  border-color: var(--color-primary);
}

.dropdown-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.dropdown-chevron {
  flex: 0 0 auto;
  color: var(--color-muted-2);
  transition: transform var(--dur-fast) var(--ease-out);
}

.is-open .dropdown-chevron {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: var(--z-topbar);
  min-width: 100%;
  padding: var(--space-1);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.dropdown-menu.align-end {
  right: 0;
  left: auto;
}

@media (max-width: 767px) {
  /* 触控目标不小于 44×44 */
  .dropdown-trigger {
    height: 44px;
  }
}

.dropdown-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
  height: 34px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  text-align: left;
  white-space: nowrap;
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.dropdown-option:hover,
.dropdown-option:focus-visible {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.dropdown-option.is-selected {
  color: var(--color-primary);
  font-weight: 500;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 160ms var(--ease-out),
    transform 160ms var(--ease-out);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
