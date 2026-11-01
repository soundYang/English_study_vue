<script setup>
/**
 * 状态胶囊
 *
 * 用途：展示学习状态（复习中 / 学习中 / 已掌握）或阅读难度（简单 / 进阶 / 挑战）
 * 用法：<StatusPill kind="status" value="mastered" />
 *       <StatusPill kind="level" value="easy" />
 *
 * props:
 *   kind  — status（默认）/ level
 *   value — 对应枚举值；未知值原样显示并使用中性色
 *   label — 可选，覆盖默认文案
 */
import { computed } from 'vue'

const STATUS_MAP = {
  // `new` 是「用户自己加进来、还没开始学」的词，产品口径统一叫「复习中」（md/22 第 84 行）。
  // 用 info 而不是 danger：它是常态不是异常；也不复用 warning，否则与「学习中」撞色
  new: { label: '复习中', tone: 'info' },
  learning: { label: '学习中', tone: 'warning' },
  mastered: { label: '已掌握', tone: 'success' },
}

const LEVEL_MAP = {
  easy: { label: '简单', tone: 'success' },
  medium: { label: '进阶', tone: 'warning' },
  hard: { label: '挑战', tone: 'danger' },
}

const props = defineProps({
  kind: {
    type: String,
    default: 'status',
    validator: (value) => ['status', 'level'].includes(value),
  },
  value: { type: String, required: true },
  label: { type: String, default: '' },
})

const meta = computed(() => {
  const source = props.kind === 'level' ? LEVEL_MAP : STATUS_MAP
  return source[props.value] || { label: props.value || '—', tone: 'muted' }
})

const displayLabel = computed(() => props.label || meta.value.label)
</script>

<template>
  <span class="status-pill" :class="`is-${meta.tone}`">
    <span class="pill-dot" aria-hidden="true" />
    <span>{{ displayLabel }}</span>
  </span>
</template>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 10px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  white-space: nowrap;
}

.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.is-success {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.is-warning {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.is-info {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.is-danger {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.is-muted {
  background: var(--color-bg-deep);
  color: var(--color-muted);
}
</style>
