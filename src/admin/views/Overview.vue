<script setup>
/**
 * 后台概览
 *
 * 用途：`/admin` 首屏四组数字——用户、生成、免费 token 池、反馈。
 *       数据来自 `GET /admin/overview`，不画趋势图（后端没有按天聚合）。
 * 用法：路由 `/admin` 默认子路由。
 */
import { computed, onMounted, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import BaseButton from '../../component/BaseButton.vue'
import StatCard from '../component/StatCard.vue'
import { fetchAdminOverview } from '../api/overview'
import { formatCount, formatPercent, formatTokens } from '../format'

const overview = ref(null)
const loading = ref(true)
const refreshing = ref(false)
const errorMessage = ref('')

const users = computed(() => overview.value?.users || { total: 0, activeToday: 0 })
const readings = computed(() => overview.value?.readings || { today: 0, total: 0 })
const feedback = computed(() => overview.value?.feedback || { open: 0, replied: 0, closed: 0 })
const budget = computed(() => overview.value?.tokens?.freeBudget || null)

const budgetValue = computed(() => {
  if (!budget.value?.enabled) return '未启用'
  return formatPercent(budget.value.usedTokens, budget.value.limitTokens)
})

const budgetHint = computed(() => {
  const data = budget.value
  if (!data?.enabled) return '免费池未启用，生成按用户自己的 Key 计费'

  const base = `已用 ${formatTokens(data.usedTokens)} / ${formatTokens(data.limitTokens)}`
  return data.exhausted ? `${base} · 已耗尽` : base
})

// 进度条宽度按真实比例，但不超过 100%：用尽后再超出也只是满格
const budgetWidth = computed(() => {
  const data = budget.value
  if (!data?.enabled) return '0%'

  const limit = Number(data.limitTokens) || 0
  const used = Number(data.usedTokens) || 0
  if (limit <= 0) return '0%'

  return `${Math.min(100, (used / limit) * 100)}%`
})

async function load({ silent = false } = {}) {
  if (silent && refreshing.value) return
  if (!silent) loading.value = true
  refreshing.value = true
  errorMessage.value = ''

  try {
    overview.value = await fetchAdminOverview()
  } catch (error) {
    errorMessage.value = error?.message || '加载失败，请稍后重试。'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

onMounted(() => load())
</script>

<template>
  <section class="overview">
    <div class="toolbar">
      <p class="toolbar-note">数字来自真实后端，刷新只重拉本页。</p>
      <BaseButton
        variant="secondary"
        size="sm"
        :loading="refreshing"
        @click="load({ silent: true })"
      >
        <RefreshCw v-if="!refreshing" :size="14" :stroke-width="1.8" aria-hidden="true" />
        刷新
      </BaseButton>
    </div>

    <div v-if="errorMessage" class="error-strip" role="alert">
      <span>{{ errorMessage }}</span>
      <button type="button" class="error-action" @click="load({ silent: true })">重试</button>
    </div>

    <!-- 首屏失败时不给四张全 0 的卡：那会被读成「真的没有人用」 -->
    <div v-if="overview || loading" class="stat-grid">
      <StatCard
        label="用户总数"
        :value="formatCount(users.total)"
        :hint="`今日活跃 ${formatCount(users.activeToday)}`"
        :loading="loading && !overview"
      />

      <StatCard
        label="今日生成"
        :value="formatCount(readings.today)"
        :hint="`累计 ${formatCount(readings.total)}`"
        :loading="loading && !overview"
      />

      <StatCard
        label="免费 token 池"
        :value="budgetValue"
        :hint="budgetHint"
        :value-title="
          budget?.enabled
            ? `已用 ${formatCount(budget.usedTokens)} / ${formatCount(budget.limitTokens)}`
            : ''
        "
        :loading="loading && !overview"
      >
        <div v-if="budget?.enabled" class="track" aria-hidden="true">
          <div
            class="fill"
            :class="{ 'is-exhausted': budget.exhausted }"
            :style="{ width: budgetWidth }"
          />
        </div>
      </StatCard>

      <StatCard
        label="待处理反馈"
        :value="formatCount(feedback.open)"
        :hint="`已回复 ${formatCount(feedback.replied)} · 已关闭 ${formatCount(feedback.closed)}`"
        :accent="feedback.open > 0"
        :loading="loading && !overview"
      />
    </div>
  </section>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.toolbar-note {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.error-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 10px var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.error-action {
  flex: 0 0 auto;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-danger);
  font-size: var(--text-small);
  text-decoration: underline;
  cursor: pointer;
}

.error-action:focus-visible {
  outline: none;
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-5);
}

.track {
  height: 6px;
  margin-top: var(--space-1);
  border-radius: var(--radius-pill);
  background: var(--color-bg-deep);
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary);
  transition: width var(--dur-progress) var(--ease-out);
}

.fill.is-exhausted {
  background: var(--color-danger);
}
</style>
