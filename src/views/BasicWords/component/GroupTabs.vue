<script setup>
/**
 * 词表分组标签
 *
 * 用途：基础词 / 日历词 / 缩写三个分组，带接口返回的条数
 * 用法：<GroupTabs v-model="group" :counts="store.counts" />
 *
 * 三个分组数之和是 651，比词表总量 650 多 1——may 既是情态动词又是五月，
 * 两个分组各算一次。这是接口的既定口径，界面不做「相加等于总数」的校验。
 *
 * props:
 *   modelValue — 当前分组（basic / calendar / abbreviation）
 *   counts     — 接口 counts 对象；null 时计数显示「—」
 * emits:
 *   update:modelValue
 */
import { computed } from 'vue'
import SegmentedControl from '../../../component/SegmentedControl.vue'
import { BASIC_GROUPS } from '../../../unit/basic-words'

const props = defineProps({
  modelValue: { type: String, required: true },
  counts: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue'])

const options = computed(() =>
  BASIC_GROUPS.map((group) => ({
    value: group.value,
    label: group.label,
    count: props.counts ? props.counts[group.value] : '—',
  })),
)

function select(value) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="group-tabs">
    <SegmentedControl
      :model-value="modelValue"
      :options="options"
      aria-label="按词表分组筛选"
      @update:model-value="select"
    />
  </div>
</template>

<style scoped>
.group-tabs {
  max-width: 100%;
}

.group-tabs :deep(.segmented) {
  display: grid;
  min-width: 420px;
}

@media (max-width: 767px) {
  .group-tabs :deep(.segmented) {
    width: 100%;
    min-width: 0;
  }
}
</style>
