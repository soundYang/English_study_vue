<script setup>
/**
 * 基础词库数字卡
 *
 * 用途：四张全量口径的统计卡——词表总量 / 可标记实词 / 已标记不认识 / 功能词
 * 用法：<BasicStats :counts="store.counts" />
 *
 * props:
 *   counts — 接口 counts 对象；null 时显示占位符，不显示 0
 *
 * 数字不随筛选、搜索、翻页变化，这是设计意图：一眼看到词表构成（md/16 §7.4）。
 */
import { BookOpen, ListOrdered, Sparkles, UserRound } from 'lucide-vue-next'

const STAT_META = [
  { key: 'all', label: '词表总量', hint: '去重后的词条', icon: BookOpen },
  { key: 'removable', label: '可标记实词', hint: '可以移除或恢复', icon: Sparkles },
  { key: 'removed', label: '已标记不认识', hint: '需要复习的词汇', icon: UserRound },
  { key: 'functionWord', label: '功能词', hint: '文章必用，不可移除', icon: ListOrdered },
]

const props = defineProps({
  counts: { type: Object, default: null },
})

/** 计数缺失时给占位符：显示 0 会被读成「一个都没有」 */
function valueOf(key) {
  if (!props.counts) return '—'

  const value = Number(props.counts[key])
  return Number.isFinite(value) ? String(value) : '—'
}
</script>

<template>
  <section class="stats-grid" aria-label="词表统计">
    <article v-for="stat in STAT_META" :key="stat.key" class="stat-card">
      <span class="stat-head">
        <span class="stat-icon" aria-hidden="true">
          <component :is="stat.icon" :size="18" :stroke-width="1.8" />
        </span>
        <span class="stat-label">{{ stat.label }}</span>
      </span>

      <span class="stat-value">{{ valueOf(stat.key) }}</span>
      <span class="stat-hint">{{ stat.hint }}</span>
    </article>
  </section>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.stat-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--color-bg-deep);
  color: var(--color-accent);
}

.stat-label {
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.stat-value {
  margin-top: var(--space-1);
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 30px;
  line-height: 38px;
  letter-spacing: 0.01em;
}

.stat-hint {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
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
    padding: var(--space-3) var(--space-4);
  }

  .stat-value {
    font-size: 24px;
    line-height: 32px;
  }
}
</style>
