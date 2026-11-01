<script setup>
/**
 * 复习统计卡
 *
 * 用途：展示复习节奏（连续天数、今日 / 累计复习次数、平均掌握轮次）与近 30 天热力图，
 *       数据来自 GET /words/stats（后端 md/56 P3）。与 /profile/stats 的阅读统计并列，
 *       但口径不同：这里的 reviewed 按「词次」计，同一词一天复习多次会累计。
 * 用法：<StudyStats :stats="studyStats" /> / 游客 <StudyStats masked />
 *
 * props:
 *   stats  — { streak, today:{reviewed,mastered}, total:{reviewed,mastered},
 *              mastery:{count,avgStage}, pendingReview, heatmap:[{date,reviewed,mastered}] }
 *            字段缺失按 0 处理
 *   masked — 游客态：四指标用 ** 遮罩，热力图只留占位块
 *
 * 口径说明：
 *   - 后端只从功能上线之日起记录，页面固定注明，不假装有更长的历史
 *   - 热力图按「列 = 一天、行 = 7」排布，最后 30 个自然日（含今天）
 */
import { computed } from 'vue'
import GuestMask from '../../../component/GuestMask.vue'

const HEATMAP_DAYS = 30
const LEVEL_MAX = 4

const props = defineProps({
  stats: { type: Object, default: null },
  masked: { type: Boolean, default: false },
})

function positive(value) {
  return Math.max(0, Math.round(Number(value) || 0))
}

const today = computed(() => props.stats?.today || {})
const total = computed(() => props.stats?.total || {})
const mastery = computed(() => props.stats?.mastery || {})

const streak = computed(() => positive(props.stats?.streak))
const reviewedToday = computed(() => positive(today.value.reviewed))
const masteredToday = computed(() => positive(today.value.mastered))
const reviewedTotal = computed(() => positive(total.value.reviewed))
const masteredTotal = computed(() => positive(total.value.mastered))
const masteryCount = computed(() => positive(mastery.value.count))
const avgStage = computed(() => {
  const value = Number(mastery.value.avgStage)
  return Number.isFinite(value) && value > 0 ? Math.round(value * 10) / 10 : 0
})

const metrics = computed(() => [
  {
    key: 'streak',
    label: '连续复习',
    value: streak.value,
    unit: '天',
    caption: streak.value > 0 ? '保持住，明天继续' : '今天复习一次就开始累计',
  },
  {
    key: 'today',
    label: '今日复习',
    value: reviewedToday.value,
    unit: '次',
    caption:
      reviewedToday.value > 0 ? `今天新掌握 ${masteredToday.value} 个词` : '今天还没有复习记录',
  },
  {
    key: 'total',
    label: '累计复习',
    value: reviewedTotal.value,
    unit: '次',
    caption: `累计掌握 ${masteredTotal.value} 个词`,
  },
  {
    key: 'mastery',
    label: '平均掌握',
    value: avgStage.value,
    unit: '轮',
    caption: `共 ${masteryCount.value} 个已掌握词`,
  },
])

const heatmap = computed(() => {
  const rows = Array.isArray(props.stats?.heatmap) ? props.stats.heatmap : []
  return rows.slice(-HEATMAP_DAYS)
})

const heatmapMax = computed(() =>
  Math.max(1, ...heatmap.value.map((item) => positive(item?.reviewed))),
)

const heatmapTotal = computed(() =>
  heatmap.value.reduce((sum, item) => sum + positive(item?.reviewed), 0),
)

// 相对最大值分四档，保证深浅对比跟个人节奏走，而不是固定阈值
const cells = computed(() =>
  heatmap.value.map((item) => {
    const count = positive(item?.reviewed)
    const level =
      count === 0 ? 0 : Math.min(LEVEL_MAX, Math.ceil((count / heatmapMax.value) * LEVEL_MAX))
    const date = String(item?.date || '')
    return {
      date,
      count,
      level,
      label: date ? `${formatCellDate(date)} · 复习 ${count} 次` : `复习 ${count} 次`,
    }
  }),
)

const heatmapLabel = computed(() => {
  if (props.masked) return '登录后查看近 30 天复习热力图'
  if (!cells.value.length) return '还没有复习记录'
  return `近 30 天复习热力图，共复习 ${heatmapTotal.value} 次`
})

function formatCellDate(date) {
  // 只用于 title / 读屏文案，不参与布局；解析失败时原样返回
  const parts = date.split('-')
  if (parts.length !== 3) return date
  return `${parts[1]}-${parts[2]}`
}
</script>

<template>
  <section class="study-stats" aria-label="复习统计">
    <header class="study-head">
      <h2 class="study-title">学习统计</h2>
      <p class="study-caveat">统计从功能上线之日起记录</p>
    </header>

    <div class="metric-grid">
      <article v-for="metric in metrics" :key="metric.key" class="metric-card">
        <p class="metric-label">{{ metric.label }}</p>
        <p class="metric-value">
          <span v-if="masked" class="metric-number">
            <GuestMask mode="number" width="2em" />
          </span>
          <span v-else class="metric-number">{{ metric.value }}</span>
          <span class="metric-unit">{{ metric.unit }}</span>
        </p>
        <p class="metric-caption">
          <template v-if="masked">登录后查看</template>
          <template v-else>{{ metric.caption }}</template>
        </p>
      </article>
    </div>

    <div class="heatmap-block">
      <p class="heatmap-caption">近 30 天</p>

      <p v-if="masked" class="heatmap-empty">登录后查看</p>
      <div v-else-if="cells.length" class="heatmap" role="group" :aria-label="heatmapLabel">
        <span
          v-for="cell in cells"
          :key="cell.date"
          class="heatmap-cell"
          :class="`is-level-${cell.level}`"
          role="img"
          :aria-label="cell.label"
          :title="cell.label"
        />
      </div>
      <p v-else class="heatmap-empty">还没有复习记录</p>

      <div v-if="!masked && cells.length" class="heatmap-legend" aria-hidden="true">
        <span>少</span>
        <span class="legend-cell is-level-0" />
        <span class="legend-cell is-level-1" />
        <span class="legend-cell is-level-2" />
        <span class="legend-cell is-level-3" />
        <span class="legend-cell is-level-4" />
        <span>多</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.study-stats {
  margin-top: var(--space-5);
  padding: var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.study-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.study-title {
  color: var(--color-ink-2);
  font-family: var(--font-display);
  font-size: var(--text-section);
  font-weight: 400;
  line-height: var(--leading-section);
}

/* 数据缺口写死在页面上：新功能不假装有完整历史 */
.study-caveat {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-5);
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-bg);
}

.metric-label {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.metric-value {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}

.metric-number {
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 26px;
  line-height: 34px;
  letter-spacing: 0.01em;
  font-variant-numeric: tabular-nums;
}

.metric-unit {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.metric-caption {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.heatmap-block {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-line);
}

.heatmap-caption {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  white-space: nowrap;
}

/* 列 = 一天、行 = 7：30 天自然排成约 5 列，窄屏也不会挤成一条线 */
.heatmap {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(7, 1fr);
  grid-auto-columns: 13px;
  gap: 4px;
  margin-left: auto;
}

.heatmap-cell,
.legend-cell {
  display: block;
  width: 13px;
  height: 13px;
  border-radius: 3px;
  background: var(--color-bg-deep);
}

.heatmap-cell.is-level-1 {
  background: color-mix(in srgb, var(--color-primary) 24%, var(--color-bg-deep));
}

.heatmap-cell.is-level-2 {
  background: color-mix(in srgb, var(--color-primary) 48%, var(--color-bg-deep));
}

.heatmap-cell.is-level-3 {
  background: color-mix(in srgb, var(--color-primary) 72%, var(--color-bg-deep));
}

.heatmap-cell.is-level-4 {
  background: var(--color-primary);
}

.heatmap-empty {
  margin-left: auto;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-muted);
  font-size: 11px;
  line-height: 1;
}

.legend-cell {
  width: 11px;
  height: 11px;
}

.legend-cell.is-level-1 {
  background: color-mix(in srgb, var(--color-primary) 24%, var(--color-bg-deep));
}

.legend-cell.is-level-2 {
  background: color-mix(in srgb, var(--color-primary) 48%, var(--color-bg-deep));
}

.legend-cell.is-level-3 {
  background: color-mix(in srgb, var(--color-primary) 72%, var(--color-bg-deep));
}

.legend-cell.is-level-4 {
  background: var(--color-primary);
}

@media (max-width: 1023px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .study-stats {
    padding: var(--space-5);
  }

  .study-head {
    flex-direction: column;
    gap: var(--space-1);
  }

  .metric-grid {
    gap: var(--space-3);
  }

  .heatmap-block {
    flex-direction: column;
    align-items: flex-start;
  }

  .heatmap {
    margin-left: 0;
  }

  .heatmap-empty {
    margin-left: 0;
  }
}
</style>
