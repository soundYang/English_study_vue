<script setup>
/**
 * 学习状态索引标签
 *
 * 用途：词书上沿的四个索引标签（全部 / 新词 / 复习中 / 已掌握）+ 右侧「已排除」红色书签。
 *       「已排除」不是学习阶段，所以不并进四个标签，单独成书签（md/55 §3.2 D）。
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
import { BookmarkX } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: String, required: true },
  counts: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

// 按后端派生字段 studyState 分档（md/22 第 91 / 96 行），不再按 status：
// status='new' 一档里同时有今天加的、结算前的老词和墓碑词，任何中文名都名不副实。
// all 是前三档之和，不含 removed——墓碑词不是学习进度，靠右侧书签单独进
const options = computed(() => {
  const counts = props.counts
  // 游客态没有个人计数：用 ** 遮罩，不显示会让人误读的 0
  const countOf = (key) => (props.disabled ? '**' : counts ? counts[key] : '—')

  return [
    { value: 'all', label: '全部', count: countOf('all') },
    { value: 'new', label: '新词', count: countOf('new') },
    { value: 'reviewing', label: '复习中', count: countOf('reviewing') },
    { value: 'mastered', label: '已掌握', count: countOf('mastered') },
  ]
})

const removedCount = computed(() => {
  if (props.disabled) return '**'
  return props.counts ? props.counts.removed : '—'
})

function select(value) {
  if (props.disabled) return
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="status-tabs">
    <div class="status-chips" role="group" aria-label="按学习状态筛选">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="status-chip"
        :class="{ 'is-active': modelValue === option.value }"
        :aria-pressed="modelValue === option.value"
        :disabled="disabled"
        @click="select(option.value)"
      >
        <span class="chip-label">{{ option.label }}</span>
        <span class="chip-count">{{ option.count }}</span>
      </button>
    </div>

    <button
      type="button"
      class="status-excluded"
      :class="{ 'is-active': modelValue === 'removed' }"
      :aria-pressed="modelValue === 'removed'"
      :disabled="disabled"
      aria-label="查看已排除的单词"
      @click="select('removed')"
    >
      <BookmarkX :size="14" :stroke-width="1.8" aria-hidden="true" />
      <span>已排除</span>
      <span class="excluded-count">{{ removedCount }}</span>
    </button>
  </div>
</template>

<style scoped>
.status-tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2) var(--space-4);
  max-width: 100%;
}

.status-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  min-width: 0;
}

/* 索引标签：贴在上沿，当前项抬起并用主色下划线，不是普通胶囊 */
.status-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 6px 10px 7px;
  border: 1px solid transparent;
  border-bottom: 2px solid transparent;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  background: transparent;
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  white-space: nowrap;
  transition:
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}

.status-chip:hover:not(:disabled) {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.status-chip.is-active {
  transform: translateY(2px);
  border-bottom-color: var(--color-primary);
  background: var(--color-surface);
  color: var(--color-ink);
}

.status-chip:focus-visible,
.status-excluded:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.status-chip:disabled,
.status-excluded:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chip-label {
  font-weight: 500;
}

.chip-count {
  color: var(--color-muted);
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
}

/* 红色书签：与「已排除」的排除语义一致，固定在索引行最右 */
.status-excluded {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-danger);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  white-space: nowrap;
  transition:
    background-color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}

.status-excluded:hover:not(:disabled) {
  border-color: var(--color-danger);
  background: var(--color-danger-bg);
}

.status-excluded.is-active {
  border-color: var(--color-danger);
  background: var(--color-danger-bg);
  font-weight: 500;
}

.excluded-count {
  font-variant-numeric: tabular-nums;
}

@media (max-width: 767px) {
  .status-chips {
    flex-wrap: nowrap;
    width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .status-chips::-webkit-scrollbar {
    display: none;
  }

  .status-chip {
    padding: 6px 8px 7px;
    font-size: var(--text-caption);
  }

  .status-excluded {
    margin-left: auto;
  }
}
</style>
