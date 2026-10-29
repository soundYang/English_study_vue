<script setup>
/**
 * 历史统计卡
 * 展示总练习次数、平均正确率、最高分与累计阅读词数。
 * 首次拿到 stats 时 900ms count-up；分页或筛选返回相同数值时不重复动画。
 *
 * 用法：<StatsGrid :stats="stats" :loading="loading" />
 *
 * props:
 *   stats    — 历史接口返回的 stats；为空时显示占位
 *   loading  — 首次加载骨架；已有 stats 时不再显示骨架
 *   masked   — 游客态：数值用 ** 遮罩，不跑 count-up
 *   duration — 计数动画时长，默认 900ms；测试可传 0
 */
import { computed, watch } from 'vue'
import { BookOpen, Library, Target, Trophy } from 'lucide-vue-next'
import GuestMask from '../../../component/GuestMask.vue'
import SkeletonBlock from '../../../component/SkeletonBlock.vue'
import { useCountUp } from '../../../composables/useCountUp'

const STAT_META = [
  { key: 'totalCount', label: '总练习次数', unit: '次', icon: BookOpen },
  { key: 'averageAccuracy', label: '平均正确率', unit: '%', icon: Target },
  { key: 'bestScore', label: '最高分', unit: '分', icon: Trophy },
  { key: 'totalWordsRead', label: '累计阅读词数', unit: '词', icon: Library },
]

const props = defineProps({
  stats: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  masked: { type: Boolean, default: false },
  duration: { type: Number, default: 900 },
})

const counters = STAT_META.map((meta) => {
  const { value, start } = useCountUp({ duration: props.duration })
  return { ...meta, count: value, start }
})

const showSkeleton = computed(() => props.loading && !props.stats)
const hasStats = computed(() => Boolean(props.stats))

let lastSignature = ''

// 统计只在数值真正变化时重新计数，翻页与筛选不会让数字反复归零
watch(
  () => props.stats,
  (stats) => {
    if (!stats) return

    const values = STAT_META.map((meta) => Math.max(0, Math.round(Number(stats[meta.key]) || 0)))
    const signature = values.join('|')
    if (signature === lastSignature) return

    lastSignature = signature
    counters.forEach((counter, index) => counter.start(values[index]))
  },
  { immediate: true },
)

function statValue(counter) {
  if (!hasStats.value) return '—'
  return String(Math.round(counter.count.value))
}
</script>

<template>
  <section class="stats-grid" aria-label="练习统计">
    <article v-for="counter in counters" :key="counter.key" class="stat-card">
      <span class="stat-icon" aria-hidden="true">
        <component :is="counter.icon" :size="18" :stroke-width="1.8" />
      </span>

      <span class="stat-label">{{ counter.label }}</span>

      <SkeletonBlock v-if="showSkeleton" width="72px" height="28px" />
      <span v-else-if="masked" class="stat-value">
        <GuestMask mode="number" />
      </span>
      <span v-else class="stat-value">
        <span class="stat-number">{{ statValue(counter) }}</span>
        <span v-if="hasStats" class="stat-unit">{{ counter.unit }}</span>
      </span>
    </article>
  </section>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-5);
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-5);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--color-bg-deep);
  color: var(--color-accent);
}

.stat-label {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  letter-spacing: 0.04em;
}

.stat-value {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  min-height: 36px;
}

.stat-number {
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 28px;
  line-height: 36px;
  letter-spacing: 0.01em;
}

.stat-unit {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

@media (max-width: 1279px) {
  .stats-grid {
    gap: var(--space-4);
  }
}

@media (max-width: 1023px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .stats-grid {
    gap: var(--space-3);
  }

  .stat-card {
    padding: var(--space-4);
  }

  .stat-number {
    font-size: 24px;
    line-height: 32px;
  }
}
</style>
