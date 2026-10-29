<script setup>
/**
 * 后台指标卡
 *
 * 用途：概览页四张卡片与详情页的分组数字，统一「标签 / 主数字 / 副信息」结构。
 * 用法：<StatCard label="用户总数" :value="formatCount(users.total)" hint="今日活跃 34" />
 *       <StatCard label="免费 token 池" :value="'6.2%'" hint="已用 …">
 *         <div class="track">…</div>
 *       </StatCard>
 *
 * props:
 *   label   — 顶部小标签
 *   value   — 主数字（已格式化）
 *   hint      — 副信息
 *   valueTitle — 主数字的悬浮说明（紧凑格式下的精确值）
 *   loading   — 首屏骨架
 *   accent    — 主数字用强调色（如待处理反馈 > 0）
 * slots:
 *   default — 主数字与副信息之间的补充内容（进度条等）
 */
import SkeletonBlock from '../../component/SkeletonBlock.vue'

defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '' },
  hint: { type: String, default: '' },
  valueTitle: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  accent: { type: Boolean, default: false },
})
</script>

<template>
  <article class="stat-card">
    <p class="stat-label">{{ label }}</p>

    <template v-if="loading">
      <SkeletonBlock height="36px" width="55%" />
      <SkeletonBlock height="16px" width="80%" />
    </template>

    <template v-else>
      <p class="stat-value" :class="{ 'is-accent': accent }" :title="valueTitle || undefined">
        {{ value }}
      </p>
      <slot />
      <p v-if="hint" class="stat-hint">{{ hint }}</p>
    </template>
  </article>
</template>

<style scoped>
.stat-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 132px;
  padding: var(--space-5) var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.stat-label {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  letter-spacing: 0.08em;
}

.stat-value {
  font-family: var(--font-display);
  font-size: 36px;
  font-variant-numeric: tabular-nums;
  line-height: 44px;
  color: var(--color-ink);
}

.stat-value.is-accent {
  color: var(--color-accent);
}

.stat-hint {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}
</style>
