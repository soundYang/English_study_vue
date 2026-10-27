<script setup>
/**
 * 成绩摘要条
 * 左侧环形分数与百分比，中间分级文案，右侧再练一次 / 返回首页 / 查看历史。
 * 环形进度与中央数字共用 900ms 计数动画；减少动效时直接显示终值。
 *
 * 用法：<ScoreSummary :score="80" :correct-count="4" :total-questions="5"
 *         :retrying="false" @retry="..." @home="..." @history="..." />
 *
 * props:
 *   score          — 0～100 的得分（正确率）
 *   correctCount   — 答对题数
 *   totalQuestions — 总题数
 *   retrying       — 再练一次生成中，按钮 loading 并禁用
 *   duration       — 计数动画时长，默认 900ms；测试可传 0
 * emits:
 *   retry / home / history
 */
import { computed, watch } from 'vue'
import { ArrowRight } from 'lucide-vue-next'
import BaseButton from '../../../component/BaseButton.vue'
import { useCountUp } from '../../../composables/useCountUp'

const RING_RADIUS = 52
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const props = defineProps({
  score: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },
  retrying: { type: Boolean, default: false },
  duration: { type: Number, default: 900 },
})

const emit = defineEmits(['retry', 'home', 'history'])

const { value: animatedScore, start } = useCountUp({ duration: props.duration })

const safeScore = computed(() => Math.min(100, Math.max(0, Math.round(Number(props.score) || 0))))
const safeCorrectCount = computed(() => Math.max(0, Math.round(Number(props.correctCount) || 0)))
const safeTotal = computed(() => Math.max(0, Math.round(Number(props.totalQuestions) || 0)))

// 由百分比反推答对数，让“4 / 5”与环、百分比保持同一节奏
const animatedCorrect = computed(() => {
  if (!safeTotal.value) return 0
  return Math.round((animatedScore.value / 100) * safeTotal.value)
})

const animatedPercent = computed(() => `${Math.round(animatedScore.value)}%`)

const ringStyle = computed(() => ({
  strokeDasharray: String(RING_CIRCUMFERENCE),
  strokeDashoffset: String(RING_CIRCUMFERENCE * (1 - animatedScore.value / 100)),
}))

const tone = computed(() => {
  if (safeScore.value === 100) return 'is-perfect'
  if (safeScore.value >= 60) return 'is-good'
  return 'is-low'
})

const copy = computed(() => {
  if (safeScore.value === 100) return '太棒了！你已经完全掌握了这篇文章的内容！'
  if (safeScore.value >= 80) return '很不错！再巩固一下错题就更稳了。'
  if (safeScore.value >= 60) return '基础不错，重点复习错题和生词。'
  return '别灰心，把文章再读一遍，明天再试一次。'
})

const ariaLabel = computed(
  () => `得分 ${safeCorrectCount.value} / ${safeTotal.value}，正确率 ${safeScore.value}%`,
)

watch(
  () => props.score,
  () => start(safeScore.value),
  { immediate: true },
)
</script>

<template>
  <section class="score-summary" :class="tone">
    <div class="ring" role="img" :aria-label="ariaLabel">
      <svg class="ring-svg" viewBox="0 0 120 120" aria-hidden="true">
        <circle class="ring-track" cx="60" cy="60" :r="RING_RADIUS" />
        <circle class="ring-progress" cx="60" cy="60" :r="RING_RADIUS" :style="ringStyle" />
      </svg>
      <div class="ring-center" aria-hidden="true">
        <span class="ring-fraction">{{ animatedCorrect }} / {{ safeTotal }}</span>
        <span class="ring-percent">{{ animatedPercent }}</span>
      </div>
    </div>

    <p class="score-copy" aria-live="polite">{{ copy }}</p>

    <div class="score-actions">
      <BaseButton :loading="retrying" @click="emit('retry')">再练一次</BaseButton>
      <BaseButton variant="secondary" :disabled="retrying" @click="emit('home')">
        返回首页
      </BaseButton>
      <button type="button" class="history-link" :disabled="retrying" @click="emit('history')">
        <span>查看历史</span>
        <ArrowRight :size="14" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.score-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-6) var(--space-8);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.ring {
  position: relative;
  width: 108px;
  height: 108px;
  flex-shrink: 0;
}

.ring-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-track,
.ring-progress {
  fill: none;
  stroke-width: 8;
}

.ring-track {
  stroke: var(--color-line);
}

.ring-progress {
  stroke: var(--color-primary);
  stroke-linecap: round;
}

.is-perfect .ring-progress {
  stroke: var(--color-success);
}

.is-low .ring-progress {
  stroke: var(--color-warning);
}

.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.ring-fraction {
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 24px;
  line-height: 30px;
  letter-spacing: 0.01em;
}

.ring-percent {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.score-copy {
  max-width: 38ch;
  color: var(--color-ink-2);
  font-size: var(--text-body);
  line-height: var(--leading-body);
  animation: score-copy-in var(--dur-base) var(--ease-out) 200ms both;
}

.score-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
}

.history-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: var(--space-1) 0;
  border: none;
  background: none;
  color: var(--color-accent);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  transition: color var(--dur-fast) var(--ease-out);
}

.history-link:hover:not(:disabled) {
  color: var(--color-ink);
}

.history-link:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@keyframes score-copy-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 767px) {
  .score-summary {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    gap: var(--space-4);
    padding: var(--space-6) var(--space-5);
    text-align: center;
  }

  .score-copy {
    max-width: 30ch;
  }

  .score-actions {
    flex-direction: column;
    width: 100%;
  }

  .score-actions :deep(.base-button) {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .score-copy {
    animation: none;
  }
}
</style>
