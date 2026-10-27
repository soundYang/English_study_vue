<script setup>
/**
 * 答题页顶部信息行
 *
 * 用途：返回/退出、建议用时倒计时、难度、当前题进度与可点击的进度段
 * 用法：<ReadingHeader :remaining="900" level="easy" :current="1" :total="5"
 *          :questions="questions" :answered-ids="[1]" @exit="askExit" @jump="jump" />
 *
 * props:
 *   remaining   — 剩余秒数
 *   level       — easy / medium / hard
 *   current     — 当前题号（1 起）
 *   total       — 总题数
 *   questions   — 题目数组，用于渲染进度段
 *   answeredIds — 已作答题目的 id
 *   disabled    — 提交中禁用退出与跳转
 * emits:
 *   exit — 点击返回
 *   jump — 点击进度段，参数为题目 id
 */
import { computed } from 'vue'
import { ChevronLeft, Clock } from 'lucide-vue-next'
import BaseButton from '../../../component/BaseButton.vue'
import StatusPill from '../../../component/StatusPill.vue'
import { formatClock } from '../../../unit/format'

const props = defineProps({
  remaining: { type: Number, default: 0 },
  level: { type: String, default: 'easy' },
  current: { type: Number, default: 1 },
  total: { type: Number, default: 0 },
  questions: { type: Array, default: () => [] },
  answeredIds: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['exit', 'jump'])

const clock = computed(() => formatClock(props.remaining))
const isUrgent = computed(() => props.remaining > 0 && props.remaining <= 60)
const isFinished = computed(() => props.remaining <= 0)

function isAnswered(id) {
  return props.answeredIds.includes(id)
}
</script>

<template>
  <header class="reading-header">
    <div class="header-main">
      <BaseButton
        variant="ghost"
        size="sm"
        class="back-button"
        :disabled="disabled"
        aria-label="退出本次练习"
        @click="emit('exit')"
      >
        <ChevronLeft :size="16" :stroke-width="1.8" aria-hidden="true" />
        <span class="back-label">返回</span>
      </BaseButton>

      <span
        class="timer-pill"
        :class="{ 'is-urgent': isUrgent, 'is-finished': isFinished }"
        aria-hidden="true"
      >
        <Clock :size="14" :stroke-width="1.8" />
        <span class="timer-text">{{ clock }}</span>
      </span>

      <StatusPill kind="level" :value="level" class="header-level" />

      <div class="progress-summary">
        <span class="progress-text">第 {{ current }} 题 / 共 {{ total }} 题</span>
        <div class="progress-segments" role="group" aria-label="题目进度">
          <button
            v-for="(question, index) in questions"
            :key="question.id"
            type="button"
            class="progress-segment"
            :class="{
              'is-active': current === index + 1,
              'is-answered': isAnswered(question.id),
            }"
            :aria-label="`跳到第 ${index + 1} 题`"
            :aria-current="current === index + 1 ? 'step' : undefined"
            :disabled="disabled"
            @click="emit('jump', question.id)"
          >
            <span class="segment-bar" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.reading-header {
  margin-bottom: var(--space-5);
}

.header-main {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.back-button {
  margin-left: calc(var(--space-2) * -1);
  color: var(--color-muted);
}

.back-button:hover:not(:disabled) {
  color: var(--color-ink);
}

.timer-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-ink-2);
  font-variant-numeric: tabular-nums;
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.timer-pill.is-urgent {
  border-color: var(--color-danger);
  color: var(--color-danger);
  animation: timer-pulse 1s var(--ease-in-out) infinite;
}

.timer-pill.is-finished {
  border-color: var(--color-line-strong);
  color: var(--color-muted);
}

.timer-text {
  letter-spacing: 0.02em;
}

.progress-summary {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  min-width: 0;
}

.progress-text {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  white-space: nowrap;
}

.progress-segments {
  display: flex;
  align-items: center;
  gap: 4px;
}

.progress-segment {
  display: flex;
  align-items: center;
  width: 30px;
  height: 28px;
  padding: 0;
  border-radius: var(--radius-sm);
}

.segment-bar {
  display: block;
  width: 100%;
  height: 4px;
  border-radius: var(--radius-pill);
  background: var(--color-line);
  transition: background-color var(--dur-progress) var(--ease-out);
}

.progress-segment.is-answered .segment-bar {
  background: var(--color-line-strong);
}

.progress-segment.is-active .segment-bar {
  background: var(--color-primary);
}

.progress-segment:hover:not(:disabled) .segment-bar {
  background: var(--color-muted-2);
}

.progress-segment.is-active:hover:not(:disabled) .segment-bar {
  background: var(--color-primary-hover);
}

.progress-segment:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@keyframes timer-pulse {
  50% {
    opacity: 0.65;
  }
}

@media (max-width: 767px) {
  .header-main {
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .back-label,
  .header-level {
    display: none;
  }

  .progress-summary {
    flex-basis: 100%;
    justify-content: space-between;
    order: 3;
    padding-top: var(--space-1);
  }

  .progress-segments {
    flex: 1;
    max-width: 220px;
  }

  .progress-segment {
    flex: 1;
    width: auto;
    /* 触控目标不小于 44×44，进度条本身仍保持 4px 细线 */
    height: 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .timer-pill.is-urgent {
    animation: none;
  }
}
</style>
