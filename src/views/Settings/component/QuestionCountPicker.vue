<script setup>
/**
 * 题目数量选择器
 *
 * 用途：“题目数量”行标签 + 3 / 5 / 8 三档分段控件
 * 用法：<QuestionCountPicker v-model="draft.questionCount" :disabled="isGenerating" />
 *
 * props:
 *   modelValue — 当前题目数量
 *   disabled   — 生成中禁用
 * emits:
 *   update:modelValue — 题目数量变化
 */
import SegmentedControl from '../../../component/SegmentedControl.vue'

const OPTIONS = [
  { value: 3, label: '3 题' },
  { value: 5, label: '5 题' },
  { value: 8, label: '8 题' },
]

defineProps({
  modelValue: { type: Number, required: true },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="count-row">
    <span id="question-count-label" class="row-label">题目数量</span>
    <SegmentedControl
      :model-value="modelValue"
      :options="OPTIONS"
      aria-label="题目数量"
      :disabled="disabled"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<style scoped>
.count-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.row-label {
  flex: 0 0 100px;
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

@media (max-width: 767px) {
  .row-label {
    flex-basis: 88px;
  }
}
</style>
