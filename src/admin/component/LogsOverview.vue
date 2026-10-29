<script setup>
/**
 * 日志概览
 *
 * 用途：`/admin/logs?tab=overview`——最近 N 天的请求量、唯一 IP、错误数、登录情况，
 *       加一张错误码 Top 10 表（`md/53 §10` 的 `/summary`）。
 * 用法：<LogsOverview :days="7" :reload-token="token" />，由 Logs.vue 持有时间窗口。
 *
 * 约定：
 *   - 窗口固定为「最近 N 天」（1–90），不开放任意区间：需要精确区间就用三个列表接口
 *   - 数字为 0 时照常显示：与概览页不同，这里的 0 本身是结论（「这段时间没人打接口」）
 */
import { computed, ref, watch } from 'vue'
import StatCard from './StatCard.vue'
import { fetchLogSummary } from '../api/logs'
import { formatCount, formatPercent } from '../format'

const props = defineProps({
  days: { type: Number, required: true },
  reloadToken: { type: Number, default: 0 },
})

const summary = ref(null)
const loading = ref(true)
const errorMessage = ref('')

const access = computed(
  () => summary.value?.access || { total: 0, ok: 0, clientError: 0, serverError: 0, uniqueIps: 0 },
)
const errors = computed(() => summary.value?.errors || { total: 0, byCode: [] })
const logins = computed(
  () =>
    summary.value?.logins || { total: 0, failed: 0, uniqueUsers: 0, byRole: { user: 0, admin: 0 } },
)

const errorRows = computed(() => errors.value.byCode || [])

const errorCardHint = computed(() => {
  if (!errors.value.total) return '窗口内没有 5xx'
  const top = errorRows.value[0]
  return top ? `最多：${top.code}（${formatCount(top.count)} 次）` : ''
})

const loginHint = computed(() => {
  const data = logins.value
  return `失败 ${formatCount(data.failed)} · 用户 ${formatCount(data.uniqueUsers)} · 管理员 ${formatCount(
    data.byRole?.admin,
  )}`
})

async function load() {
  loading.value = true
  errorMessage.value = ''

  try {
    summary.value = await fetchLogSummary({ days: props.days })
  } catch (error) {
    errorMessage.value = error?.message || '加载失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}

watch(() => [props.days, props.reloadToken], load, { immediate: true })
</script>

<template>
  <section class="logs-overview">
    <div v-if="errorMessage" class="error-strip" role="alert">
      <span>{{ errorMessage }}</span>
      <button type="button" class="error-action" @click="load">重试</button>
    </div>

    <!-- 首屏失败时不给四张全 0 的卡：那会被读成「这段时间真的没有请求」 -->
    <div
      v-if="summary || loading"
      class="stat-grid"
      :class="{ 'is-stale': errorMessage && summary }"
    >
      <StatCard
        label="请求总量"
        :value="formatCount(access.total)"
        :hint="`2xx ${formatCount(access.ok)} · 4xx ${formatCount(access.clientError)} · 5xx ${formatCount(access.serverError)}`"
        :loading="loading && !summary"
      />
      <StatCard
        label="唯一 IP"
        :value="formatCount(access.uniqueIps)"
        hint="按来源 IP 去重"
        :loading="loading && !summary"
      />
      <StatCard
        label="错误总数"
        :value="formatCount(errors.total)"
        :hint="errorCardHint"
        :accent="errors.total > 0"
        :loading="loading && !summary"
      />
      <StatCard
        label="登录尝试"
        :value="formatCount(logins.total)"
        :hint="loginHint"
        :loading="loading && !summary"
      />
    </div>

    <section v-if="summary" class="errors-card" aria-labelledby="logs-error-codes-title">
      <header class="errors-head">
        <h2 id="logs-error-codes-title" class="errors-title">错误码 Top 10</h2>
        <p class="errors-note">来自报错日志，只收 5xx；4xx 看「访问」的状态码</p>
      </header>

      <p v-if="!errorRows.length" class="errors-empty">这段窗口里没有 5xx。</p>

      <table v-else class="errors-table">
        <thead>
          <tr>
            <th>错误码</th>
            <th class="num">次数</th>
            <th class="num">占比</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in errorRows" :key="item.code">
            <td>
              <span class="code">{{ item.code }}</span>
            </td>
            <td class="num">{{ formatCount(item.count) }}</td>
            <td class="num">{{ formatPercent(item.count, errors.total) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>

<style scoped>
.logs-overview {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
}

.is-stale {
  opacity: 0.55;
}

.errors-card {
  padding: var(--space-5) var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.errors-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.errors-title {
  font-family: var(--font-display);
  font-size: 16px;
  line-height: 24px;
  color: var(--color-ink);
}

.errors-note {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.errors-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  line-height: 22px;
}

.errors-table th {
  padding: 8px var(--space-3);
  border-bottom: 1px solid var(--color-line);
  color: var(--color-muted);
  font-size: var(--text-caption);
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
}

.errors-table td {
  padding: 10px var(--space-3);
  border-bottom: 1px solid var(--color-line);
  color: var(--color-ink-2);
}

.errors-table tbody tr:last-child td {
  border-bottom: none;
}

.errors-table .num {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--text-caption);
}

.errors-empty {
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
</style>
