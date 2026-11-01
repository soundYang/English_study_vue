<script setup>
/**
 * 学习状态标签行
 *
 * 用途：全部 / 新词 / 复习中 / 已掌握 / 不认识 单选，带接口返回的计数；计数未知时显示“—”
 * 用法：<WordStatusTabs v-model="study" :counts="store.studyCounts" />
 *
 * props:
 *   modelValue — 当前筛选值，取值即接口的 `study` 参数（all / new / reviewing / mastered / removed）
 *   counts     — 接口 studyCounts 对象；null 表示尚未加载
 *   disabled   — 游客态禁用切换（计数用 ** 遮罩）
 * emits:
 *   update:modelValue
 */
import { computed } from 'vue'
import SegmentedControl from '../../../component/SegmentedControl.vue'

const props = defineProps({
  modelValue: { type: String, required: true },
  counts: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const options = computed(() => {
  const counts = props.counts
  // 游客态没有个人计数：用 ** 遮罩，不显示会让人误读的 0
  const countOf = (key) => (props.disabled ? '**' : counts ? counts[key] : '—')

  // 按后端派生字段 studyState 分档（md/22 第 91 / 96 行），不再按 status：
  // status='new' 一档里同时有今天加的、结算前的老词和墓碑词，任何中文名都名不副实。
  // `all` 是前三档之和，不含「不认识」——墓碑词不是学习进度，靠这一档单独进
  return [
    { value: 'all', label: '全部', count: countOf('all') },
    { value: 'new', label: '新词', count: countOf('new') },
    { value: 'reviewing', label: '复习中', count: countOf('reviewing') },
    { value: 'mastered', label: '已掌握', count: countOf('mastered') },
    { value: 'removed', label: '不认识', count: countOf('removed') },
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
      :disabled="disabled"
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
  /* 五档（全部 / 新词 / 复习中 / 已掌握 / 不认识）挤在 375px 上，
     原来的 8px 内边距会让「复习中 13」超出一格，收到 4px 并禁止换行 */
  .status-tabs :deep(.segmented-item) {
    gap: 2px;
    padding: 0 4px;
    font-size: var(--text-caption);
    white-space: nowrap;
  }

  .status-tabs :deep(.segment-count) {
    font-size: 11px;
  }
}
</style>
