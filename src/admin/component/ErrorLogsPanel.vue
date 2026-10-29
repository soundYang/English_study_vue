<script setup>
/**
 * 报错日志面板
 *
 * 用途：`/admin/logs?tab=errors`——只记 5xx（未处理异常）。4xx 是预期分支，
 *       答案在访问日志的 statusCode 里，这里不会出现（md/53 §5.3）。
 * 用法：<ErrorLogsPanel :range="range" :reload-token="token" />，由 Logs.vue 持有时间范围。
 *
 * 约定：
 *   - `code` / `ip` 精确匹配，`path` 包含匹配
 *   - 堆栈默认收起：`<details>` 展开后才是 `<pre>`，不让一屏全是报错栈
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import BaseInput from '../../component/BaseInput.vue'
import CopyButton from './CopyButton.vue'
import LogsTable from './LogsTable.vue'
import { fetchErrorLogs } from '../api/logs'
import { logStatusTone, resolveLogRange } from '../log-options'
import { formatCount, formatDate, formatTime } from '../format'

const DEBOUNCE_MS = 250

const props = defineProps({
  range: { type: String, required: true },
  reloadToken: { type: Number, default: 0 },
})

const COLUMNS = [
  { key: 'time', label: '时间', width: '120px' },
  { key: 'requestId', label: '请求 ID', width: '190px' },
  { key: 'request', label: '请求' },
  { key: 'status', label: '状态', width: '80px' },
  { key: 'code', label: '错误码', width: '170px' },
  { key: 'message', label: '信息' },
  { key: 'ip', label: 'IP', width: '150px' },
  { key: 'user', label: '用户', width: '150px' },
]

const ip = ref('')
const code = ref('')
const path = ref('')
const page = ref(1)
const size = ref(20)
const rows = ref([])
const total = ref(0)
const loading = ref(true)
const errorMessage = ref('')

let timer = null
let requestSeq = 0

const filterKey = computed(() =>
  JSON.stringify([ip.value.trim(), code.value.trim(), path.value.trim()]),
)

const query = computed(() => ({
  ip: ip.value.trim(),
  code: code.value.trim(),
  path: path.value.trim(),
  page: page.value,
  size: size.value,
  range: props.range,
  reload: props.reloadToken,
}))

let lastFilterKey = filterKey.value
let firstRun = true

watch(
  query,
  () => {
    if (filterKey.value !== lastFilterKey) {
      lastFilterKey = filterKey.value
      if (page.value !== 1) {
        page.value = 1
        return
      }
    }

    if (firstRun) {
      firstRun = false
      load()
      return
    }

    clearTimeout(timer)
    timer = setTimeout(load, DEBOUNCE_MS)
  },
  { immediate: true },
)

async function load() {
  clearTimeout(timer)
  const current = query.value
  const seq = requestSeq + 1
  requestSeq = seq
  loading.value = true
  errorMessage.value = ''

  try {
    const data = await fetchErrorLogs({
      page: current.page,
      size: current.size,
      ip: current.ip,
      code: current.code,
      path: current.path,
      from: resolveLogRange(current.range).from,
    })
    if (seq !== requestSeq) return
    rows.value = data.items || []
    total.value = data.total || 0
  } catch (error) {
    if (seq !== requestSeq) return
    errorMessage.value = error?.message || '加载失败，请稍后重试。'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function resetFilters() {
  ip.value = ''
  code.value = ''
  path.value = ''
  if (page.value !== 1) page.value = 1
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <LogsTable
    :columns="COLUMNS"
    :rows="rows"
    :total="total"
    :loading="loading"
    :error-message="errorMessage"
    :page="page"
    :size="size"
    min-width="1280px"
    :note="`共 ${formatCount(total)} 条报错`"
    empty-title="没有报错记录"
    empty-description="这段时间没有 5xx；4xx 请到「访问」里按状态码查"
    @update:page="page = $event"
    @update:size="size = $event"
    @retry="load"
    @reset="resetFilters"
  >
    <template #filters>
      <BaseInput
        v-model="ip"
        class="filter-input"
        aria-label="按 IP 筛选"
        placeholder="IP 精确匹配"
      />
      <BaseInput
        v-model="code"
        class="filter-input"
        aria-label="按错误码筛选"
        placeholder="错误码，如 INTERNAL_ERROR"
      />
      <BaseInput
        v-model="path"
        class="filter-input"
        aria-label="按路径筛选"
        placeholder="路径包含"
      />
    </template>

    <template #cell-time="{ row }">
      <span class="cell-main num">{{ formatDate(row.createdAt) }}</span>
      <span class="cell-sub num">{{ formatTime(row.createdAt) }}</span>
    </template>

    <template #cell-requestId="{ row }">
      <span class="request-id">
        <span class="mono" :title="row.requestId">{{ row.requestId || '—' }}</span>
        <CopyButton :value="row.requestId" label="请求 ID" />
      </span>
    </template>

    <template #cell-request="{ row }">
      <span class="cell-main request">
        <span class="method">{{ row.method }}</span>
        <span class="path" :title="row.path">{{ row.path }}</span>
      </span>
    </template>

    <template #cell-status="{ row }">
      <span class="num" :class="logStatusTone(row.statusCode)">{{ row.statusCode }}</span>
    </template>

    <template #cell-code="{ row }">
      <span class="mono" :title="row.code">{{ row.code }}</span>
    </template>

    <template #cell-message="{ row }">
      <span class="cell-main message" :title="row.message">{{ row.message || '—' }}</span>
      <details v-if="row.stack" class="stack">
        <summary>堆栈</summary>
        <pre>{{ row.stack }}</pre>
      </details>
    </template>

    <template #cell-ip="{ row }">
      <span :title="row.userAgent">{{ row.ip || '—' }}</span>
    </template>

    <template #cell-user="{ row }">
      <RouterLink
        v-if="row.userId"
        class="user-link"
        :to="{ name: 'admin-user', params: { dataKey: row.userId } }"
      >
        {{ row.userId }}
      </RouterLink>
      <span v-else class="is-muted">未登录</span>
    </template>
  </LogsTable>
</template>

<style scoped>
.filter-input {
  width: 200px;
}

.request {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.method {
  flex: 0 0 auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  color: var(--color-muted);
  letter-spacing: 0.04em;
}

.path {
  overflow: hidden;
  max-width: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-link {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.request-id {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.mono {
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--text-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.stack {
  margin-top: 4px;
}

.stack summary {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  cursor: pointer;
}

.stack pre {
  overflow-x: auto;
  max-width: 520px;
  max-height: 240px;
  margin-top: 6px;
  padding: 10px var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-bg-deep);
  color: var(--color-ink-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-all;
}

@media (max-width: 767px) {
  .filter-input {
    width: 100%;
  }
}
</style>
