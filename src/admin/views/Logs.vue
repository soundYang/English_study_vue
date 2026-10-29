<script setup>
/**
 * 后台日志
 *
 * 用途：`/admin/logs`——四个只读 tab：概览 / 访问 / 报错 / 登录（md/53 §10）。
 *       四个接口都要求管理员令牌，页面本身不提供任何写操作，也不轮询：
 *       进入、切时间范围或点「刷新」时各拉一次。
 * 用法：路由 `/admin/logs`；`tab` 与 `range` 写进 URL，刷新与返回都保持现场。
 *
 * 约定：
 *   - 字段筛选（IP / 路径 / 错误码…）留在各面板内存里：排查现场不需要可分享链接
 *   - 时间范围只给三档快捷值，与 `/summary` 的 1–90 天窗口对齐
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RefreshCw } from 'lucide-vue-next'
import BaseButton from '../../component/BaseButton.vue'
import DropdownSelect from '../../component/DropdownSelect.vue'
import SegmentedControl from '../../component/SegmentedControl.vue'
import AccessLogsPanel from '../component/AccessLogsPanel.vue'
import ErrorLogsPanel from '../component/ErrorLogsPanel.vue'
import LoginLogsPanel from '../component/LoginLogsPanel.vue'
import LogsOverview from '../component/LogsOverview.vue'
import {
  LOG_RANGE_DEFAULT,
  LOG_RANGE_OPTIONS,
  LOG_TAB_OPTIONS,
  resolveLogRange,
} from '../log-options'

const route = useRoute()
const router = useRouter()

const refreshToken = ref(0)

/** URL 是 tab / 时间范围的唯一数据源；非法值回落到默认，避免手改地址把页面打空 */
const params = computed(() => {
  const tab = LOG_TAB_OPTIONS.some((option) => option.value === route.query.tab)
    ? route.query.tab
    : 'overview'
  const range = LOG_RANGE_OPTIONS.some((option) => option.value === route.query.range)
    ? route.query.range
    : LOG_RANGE_DEFAULT

  return { tab, range }
})

/** 只写非默认值，地址栏保持干净 */
function toRouteQuery(next) {
  const query = {}
  if (next.tab !== 'overview') query.tab = next.tab
  if (next.range !== LOG_RANGE_DEFAULT) query.range = next.range
  return query
}

const tab = computed({
  get: () => params.value.tab,
  set: (value) => applyQuery({ tab: value }),
})

const range = computed({
  get: () => params.value.range,
  set: (value) => applyQuery({ range: value }),
})

const rangeDays = computed(() => resolveLogRange(params.value.range).days)

function applyQuery(patch) {
  const next = { ...params.value, ...patch }
  const nextQuery = toRouteQuery(next)

  // 值没变就不写 URL，避免同一次切换触发两次请求
  if (JSON.stringify(nextQuery) === JSON.stringify(toRouteQuery(params.value))) return

  router.replace({ name: 'admin-logs', query: nextQuery })
}

function refresh() {
  refreshToken.value += 1
}
</script>

<template>
  <section class="logs">
    <div class="logs-head">
      <SegmentedControl v-model="tab" :options="LOG_TAB_OPTIONS" aria-label="日志分类" />

      <div class="head-actions">
        <DropdownSelect
          v-model="range"
          :options="LOG_RANGE_OPTIONS"
          aria-label="时间范围"
          align="end"
        />
        <BaseButton variant="secondary" size="sm" @click="refresh">
          <RefreshCw :size="14" :stroke-width="1.8" aria-hidden="true" />
          刷新
        </BaseButton>
      </div>
    </div>

    <p class="logs-note">
      访问日志只记失败请求（4xx / 5xx 与响应完成前断开），成功的 2xx / 3xx 不落库，
      所以概览与「访问」里的数字是失败量、不是全站流量；报错日志只记 5xx。 访问日志保留 30 天、报错
      90 天、登录记录 180 天，到期由数据库自动清理，页面不提供删除。
    </p>

    <LogsOverview v-if="tab === 'overview'" :days="rangeDays" :reload-token="refreshToken" />
    <AccessLogsPanel v-else-if="tab === 'access'" :range="range" :reload-token="refreshToken" />
    <ErrorLogsPanel v-else-if="tab === 'errors'" :range="range" :reload-token="refreshToken" />
    <LoginLogsPanel v-else :range="range" :reload-token="refreshToken" />
  </section>
</template>

<style scoped>
.logs {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.logs-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.head-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.logs-note {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

@media (max-width: 767px) {
  .logs-head {
    align-items: stretch;
  }

  .head-actions {
    justify-content: space-between;
  }
}
</style>
