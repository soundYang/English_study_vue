<script setup>
/**
 * 状态胶囊
 *
 * 用途：展示学习状态（新词 / 复习中 / 已掌握 / 不认识）或阅读难度（简单 / 进阶 / 挑战）
 * 用法：<StatusPill kind="status" value="reviewing" />
 *       <StatusPill kind="level" value="easy" />
 *
 * props:
 *   kind  — status（默认，取 studyState）/ level
 *   value — 对应枚举值；未知值原样显示并使用中性色
 *   label — 可选，覆盖默认文案
 *   stage — 可选，复习轮次（reviewStage）；> 0 时复习中显示「· 第 N 轮」
 */
import { computed } from 'vue'

// 键是**后端派生字段 `studyState`**，不是 `status`（md/22 第 91 / 96 行、md/56 §14.7）：
// `status` 同时承载学习进度与基础词减法标记（墓碑词也是 status='new'），直接拿它做文案
// 会把「还没开始学」说成「复习中」。新旧对应：new→新词、learning→复习中、mastered→已掌握。
// 新词与复习中同用 info：两者都是常态，也不该与「已掌握」的绿色抢眼
const STATUS_MAP = {
  new: { label: '新词', tone: 'info' },
  reviewing: { label: '复习中', tone: 'info' },
  mastered: { label: '已掌握', tone: 'success' },
  // 基础词表里标「不认识」产生的墓碑词，单独一档；红色沿用改名前的语气
  removed: { label: '不认识', tone: 'danger' },
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
  stage: { type: Number, default: 0 },
})

const meta = computed(() => {
  const source = props.kind === 'level' ? LEVEL_MAP : STATUS_MAP
  return source[props.value] || { label: props.value || '—', tone: 'muted' }
})

const displayLabel = computed(() => {
  if (props.label) return props.label

  // `reviewStage` 是「已通过几轮」，下一轮就是 N + 1。第 0 轮不写，
  // 否则整张表都是「第 1 轮」，反而把真正进过度的词埋掉
  if (props.kind === 'status' && props.value === 'reviewing' && props.stage > 0) {
    return `${meta.value.label} · 第 ${props.stage + 1} 轮`
  }

  return meta.value.label
})
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
