<script setup>
/**
 * 后台状态胶囊
 *
 * 用途：反馈状态（待处理 / 已回复 / 已关闭）与阅读状态（待作答 / 已提交）。
 * 用法：<AdminStatePill kind="feedback" value="open" />
 *
 * props:
 *   kind  — feedback（默认）/ reading
 *   value — 对应枚举值；未知值原样显示并用中性色
 */
import { computed } from 'vue'

const FEEDBACK_MAP = {
  open: { label: '待处理', tone: 'warning' },
  replied: { label: '已回复', tone: 'success' },
  closed: { label: '已关闭', tone: 'info' },
}

const READING_MAP = {
  generated: { label: '待作答', tone: 'warning' },
  submitted: { label: '已提交', tone: 'success' },
}

const props = defineProps({
  kind: {
    type: String,
    default: 'feedback',
    validator: (value) => ['feedback', 'reading'].includes(value),
  },
  value: { type: String, required: true },
})

const meta = computed(() => {
  const source = props.kind === 'reading' ? READING_MAP : FEEDBACK_MAP
  return source[props.value] || { label: props.value || '—', tone: 'muted' }
})
</script>

<template>
  <span class="state-pill" :class="`is-${meta.tone}`">
    <span class="pill-dot" aria-hidden="true" />
    <span>{{ meta.label }}</span>
  </span>
</template>

<style scoped>
.state-pill {
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

.is-muted {
  background: var(--color-bg-deep);
  color: var(--color-muted);
}
</style>
