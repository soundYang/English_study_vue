<script setup>
/**
 * 批量操作工具条
 *
 * 用途：有选中词时显示「已选 N 个」、目标状态下拉与「应用」；目标选项按当前标签收敛
 * 用法：<WordBatchBar :selected-count="selectedIds.size" :study="store.study"
 *                      v-model:target="batchTarget" :loading="batching"
 *                      @apply="requestBatch" @clear="clearSelection" />
 *
 * props:
 *   selectedCount — 当前页已选中的词数；为 0 时不渲染
 *   study         — 当前标签（all / new / reviewing / mastered / removed）
 *   target        — 当前目标状态；不合法时回落到该标签的第一个选项
 *   loading       — 提交中禁用操作
 * emits:
 *   update:target — 下拉切换
 *   apply         — 点击「应用」，参数为最终生效的 target
 *   clear         — 取消选择
 */
import { computed } from 'vue'
import BaseButton from '../../../component/BaseButton.vue'
import { batchTargetOptionsOf } from '../../../unit/word-batch'

const props = defineProps({
  selectedCount: { type: Number, default: 0 },
  study: { type: String, default: 'all' },
  target: { type: String, default: '' },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['update:target', 'apply', 'clear'])

const options = computed(() => batchTargetOptionsOf(props.study))

// 切标签后旧的 target 可能已经不在选项里（如「不认识」页只剩 restore），
// 这时显示与提交都以第一个选项为准，避免把 removed 发到 restore 页。
const activeTarget = computed(() => {
  const matched = options.value.find((option) => option.value === props.target)
  return matched ? matched.value : options.value[0].value
})

function handleChange(event) {
  emit('update:target', event.target.value)
}
</script>

<template>
  <div v-if="selectedCount > 0" class="batch-bar" role="region" aria-label="批量操作">
    <span class="batch-count">已选 {{ selectedCount }} 个</span>

    <div class="batch-actions">
      <select
        class="batch-target"
        :value="activeTarget"
        :disabled="loading"
        aria-label="目标状态"
        @change="handleChange"
      >
        <option v-for="option in options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>

      <BaseButton :loading="loading" @click="emit('apply', activeTarget)">应用</BaseButton>

      <button type="button" class="batch-clear" :disabled="loading" @click="emit('clear')">
        取消选择
      </button>
    </div>
  </div>
</template>

<style scoped>
.batch-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.batch-count {
  color: var(--color-ink);
  font-size: 14px;
  white-space: nowrap;
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

.batch-target {
  height: 36px;
  padding: 0 var(--space-2);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 14px;
}

.batch-target:focus {
  border-color: var(--color-primary);
}

.batch-clear {
  color: var(--color-muted);
  font-size: 14px;
  white-space: nowrap;
}

.batch-clear:hover:not(:disabled) {
  color: var(--color-ink);
}

.batch-clear:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 767px) {
  .batch-bar {
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .batch-actions {
    width: 100%;
    margin-left: 0;
  }

  .batch-target {
    flex: 1;
  }
}
</style>
