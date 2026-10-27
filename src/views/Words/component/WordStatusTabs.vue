<script setup>
/**
 * 学习状态标签行
 *
 * 用途：全部 / 已掌握 / 学习中 / 未学习 单选，带接口返回的计数；计数未知时显示“—”
 * 用法：<WordStatusTabs v-model="status" :counts="store.counts" />
 *
 * props:
 *   modelValue — 当前状态筛选值（all / mastered / learning / new）
 *   counts     — 接口 counts 对象；null 表示尚未加载
 * emits:
 *   update:modelValue
 */
import { computed } from 'vue'
import SegmentedControl from '../../../component/SegmentedControl.vue'

const props = defineProps({
  modelValue: { type: String, required: true },
  counts: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue'])

const options = computed(() => {
  const counts = props.counts
  const countOf = (key) => (counts ? counts[key] : '—')

  return [
    { value: 'all', label: '全部', count: countOf('all') },
    { value: 'mastered', label: '已掌握', count: countOf('mastered') },
    { value: 'learning', label: '学习中', count: countOf('learning') },
    { value: 'new', label: '未学习', count: countOf('new') },
  ]
})

function select(value) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="status-tabs">
    <SegmentedControl
      :model-value="modelValue"
      :options="options"
      aria-label="按学习状态筛选"
      @update:model-value="select"
    />
  </div>
</template>

<style scoped>
.status-tabs {
  max-width: 100%;
}

.status-tabs :deep(.segmented) {
  display: grid;
  width: 100%;
}

.status-tabs :deep(.segmented-item) {
  gap: var(--space-2);
}

@media (max-width: 767px) {
  .status-tabs :deep(.segmented-item) {
    gap: 4px;
    padding: 0 var(--space-2);
    font-size: var(--text-caption);
  }

  .status-tabs :deep(.segment-count) {
    font-size: 11px;
  }
}
</style>
