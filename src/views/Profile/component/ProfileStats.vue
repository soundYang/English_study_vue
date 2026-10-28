<script setup>
/**
 * 个人中心统计
 *
 * 用途：展示累计 token、按题正确率与已完成文章，并用近 12 周柱状图交代节奏。
 *       口径与后端 /profile/stats 一致：准确率按题算，token 含未提交的稿子。
 * 用法：<ProfileStats :stats="stats" />
 *
 * props:
 *   stats — { reading, questions, weekly }；字段缺失按 0 处理，不阻塞渲染
 */
import { computed } from 'vue'
import { Coins, FileText, Target } from 'lucide-vue-next'

const WEEKLY_COUNT = 12
const RING_RADIUS = 34
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

const props = defineProps({
  stats: { type: Object, default: null },
})

const reading = computed(() => props.stats?.reading || {})
const questions = computed(() => props.stats?.questions || {})

function positive(value) {
  return Math.max(0, Math.round(Number(value) || 0))
}

const tokenText = computed(() => positive(reading.value.totalTokens).toLocaleString('zh-CN'))
const generatedCount = computed(() => positive(reading.value.generatedCount))
const completedCount = computed(() => positive(reading.value.completedCount))

const answeredCount = computed(() => positive(questions.value.answered))
const correctCount = computed(() => positive(questions.value.correct))
const wrongCount = computed(() => positive(questions.value.wrong))
const accuracy = computed(() => Math.min(100, positive(questions.value.accuracy)))

const weekly = computed(() => {
  const rows = Array.isArray(props.stats?.weekly) ? props.stats.weekly : []
  return rows.slice(-WEEKLY_COUNT)
})

const weeklyMax = computed(() => Math.max(1, ...weekly.value.map((item) => positive(item?.count))))

const weeklyBars = computed(() =>
  weekly.value.map((item, index) => {
    const count = positive(item?.count)
    return {
      weekStart: String(item?.weekStart || ''),
      count,
      // 0 也留一条细线，柱状图不会在空周出现缺口
      height: count ? `${Math.max(14, Math.round((count / weeklyMax.value) * 100))}%` : '3px',
      isCurrent: index === weekly.value.length - 1,
    }
  }),
)

const weeklyTotal = computed(() =>
  weekly.value.reduce((sum, item) => sum + positive(item?.count), 0),
)

const ringStyle = computed(() => ({
  strokeDasharray: `${RING_LENGTH} ${RING_LENGTH}`,
  strokeDashoffset: `${RING_LENGTH * (1 - accuracy.value / 100)}`,
}))
</script>

<template>
  <section class="profile-stats" aria-label="学习统计">
    <article class="stat-card">
      <header class="stat-head">
        <span class="stat-icon" aria-hidden="true">
          <Coins :size="18" :stroke-width="1.8" />
        </span>
        <span class="stat-label">Token 消耗</span>
      </header>

      <p class="stat-value">
        <span class="stat-number">{{ tokenText }}</span>
        <span class="stat-unit">tokens</span>
      </p>

      <p class="stat-caption">
        <template v-if="generatedCount > 0"
          >累计生成 {{ generatedCount }} 篇，含未完成的稿子</template
        >
        <template v-else>还没有生成过文章</template>
      </p>
    </article>

    <article class="stat-card accuracy-card">
      <header class="stat-head">
        <span class="stat-icon" aria-hidden="true">
          <Target :size="18" :stroke-width="1.8" />
        </span>
        <span class="stat-label">答题准确率</span>
      </header>

      <div class="accuracy-body">
        <div
          class="accuracy-ring"
          role="img"
          :aria-label="`答题准确率 ${accuracy}%，正确 ${correctCount} 题，错误 ${wrongCount} 题`"
        >
          <svg viewBox="0 0 88 88" aria-hidden="true" focusable="false">
            <circle class="ring-track" cx="44" cy="44" :r="RING_RADIUS" />
            <circle class="ring-fill" cx="44" cy="44" :r="RING_RADIUS" :style="ringStyle" />
          </svg>
          <span class="ring-label">
            <span class="ring-number">{{ accuracy }}</span>
            <span class="ring-unit">%</span>
          </span>
        </div>

        <dl class="accuracy-breakdown">
          <div class="breakdown-row">
            <dt><span class="breakdown-dot is-correct" aria-hidden="true" />正确</dt>
            <dd>{{ correctCount }}</dd>
          </div>
          <div class="breakdown-row">
            <dt><span class="breakdown-dot is-wrong" aria-hidden="true" />错误</dt>
            <dd>{{ wrongCount }}</dd>
          </div>
        </dl>
      </div>

      <p v-if="answeredCount === 0" class="stat-caption">还没有提交过练习</p>
      <p v-else class="stat-caption">共作答 {{ answeredCount }} 题</p>
    </article>

    <article class="stat-card">
      <header class="stat-head">
        <span class="stat-icon" aria-hidden="true">
          <FileText :size="18" :stroke-width="1.8" />
        </span>
        <span class="stat-label">已完成文章</span>
      </header>

      <div class="articles-body">
        <p class="stat-value">
          <span class="stat-number">{{ completedCount }}</span>
          <span class="stat-unit">篇</span>
        </p>

        <div v-if="weeklyBars.length" class="weekly-chart" aria-hidden="true">
          <span
            v-for="bar in weeklyBars"
            :key="bar.weekStart"
            class="weekly-bar"
            :class="{ 'is-current': bar.isCurrent }"
            :style="{ height: bar.height }"
            :title="`${bar.weekStart} · ${bar.count} 篇`"
          />
        </div>
      </div>

      <p class="stat-caption">
        <template v-if="weeklyBars.length">近 12 周完成 {{ weeklyTotal }} 篇</template>
        <template v-else>暂无周统计</template>
      </p>
    </article>
  </section>
</template>

<style scoped>
.profile-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-5);
  margin-top: var(--space-5);
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 176px;
  padding: var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.stat-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--color-bg-deep);
  color: var(--color-primary);
}

.stat-label {
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.stat-value {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin-top: auto;
}

.stat-number {
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 32px;
  line-height: 40px;
  letter-spacing: 0.01em;
  font-variant-numeric: tabular-nums;
}

.stat-unit {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.stat-caption {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.accuracy-body {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-top: auto;
}

.accuracy-ring {
  position: relative;
  flex: 0 0 88px;
  width: 88px;
  height: 88px;
}

.accuracy-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-track,
.ring-fill {
  fill: none;
  stroke-width: 8;
}

.ring-track {
  stroke: var(--color-bg-deep);
}

.ring-fill {
  stroke: var(--color-primary);
  stroke-linecap: round;
  transition: stroke-dashoffset 600ms var(--ease-out);
}

.ring-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 1px;
  color: var(--color-ink);
}

.ring-number {
  align-self: center;
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 28px;
  font-variant-numeric: tabular-nums;
}

.ring-unit {
  align-self: center;
  margin-top: 4px;
  color: var(--color-muted);
  font-size: var(--text-caption);
}

.accuracy-breakdown {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.breakdown-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.breakdown-row dt {
  display: flex;
  align-items: center;
  gap: 6px;
}

.breakdown-row dd {
  margin: 0;
  color: var(--color-ink-2);
  font-size: var(--text-small);
  font-variant-numeric: tabular-nums;
}

.breakdown-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.breakdown-dot.is-correct {
  background: var(--color-success);
}

.breakdown-dot.is-wrong {
  background: var(--color-danger);
}

.articles-body {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  margin-top: auto;
}

.articles-body .stat-value {
  margin-top: 0;
}

.weekly-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  width: 116px;
  height: 44px;
}

.weekly-bar {
  flex: 1;
  min-width: 0;
  border-radius: 3px 3px 1px 1px;
  background: #c3cdbd;
}

.weekly-bar.is-current {
  background: var(--color-primary);
}

@media (max-width: 1023px) {
  .profile-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-card:last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 767px) {
  .profile-stats {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }

  .stat-card {
    min-height: 0;
    padding: var(--space-5);
  }

  .stat-card:last-child {
    grid-column: auto;
  }

  .weekly-chart {
    width: 132px;
  }
}
</style>
