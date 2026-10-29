<script setup>
/**
 * 访问日志面板
 *
 * 用途：`/admin/logs?tab=access`——每次 API 请求一条，回答「谁在什么时候调了什么、
 *       返回多少、花了多久」。4xx 只在这里出现，报错日志只有 5xx（md/53 §5.2）。
 * 用法：<AccessLogsPanel :range="range" :reload-token="token" />，由 Logs.vue 持有时间范围。
 *
 * 约定：
 *   - `ip` / `userId` 精确匹配，`path` 包含匹配，`status` 是具体状态码（后端不支持 4xx 区间）
 *   - 筛选条件只在本页内存里，不进 URL：日志页是排查现场，不需要可分享链接
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import BaseInput from '../../component/BaseInput.vue'
import DropdownSelect from '../../component/DropdownSelect.vue'
import CopyButton from './CopyButton.vue'
import LogsTable from './LogsTable.vue'
import { fetchAccessLogs } from '../api/logs'
import { ACCESS_STATUS_OPTIONS, logStatusTone, resolveLogRange } from '../log-options'
import { formatCount, formatDate, formatTime } from '../format'

const DEBOUNCE_MS = 250
// 超过 1 秒的请求标黄：管理员扫一眼就能找到慢接口
const SLOW_MS = 1000

const props = defineProps({
  range: { type: String, required: true },
  reloadToken: { type: Number, default: 0 },
})

const COLUMNS = [
  { key: 'time', label: '时间', width: '120px' },
  { key: 'request', label: '请求' },
  { key: 'status', label: '状态', width: '80px' },
  { key: 'duration', label: '耗时', width: '90px' },
  { key: 'ip', label: 'IP', width: '150px' },
  { key: 'user', label: '用户', width: '160px' },
  { key: 'requestId', label: '请求 ID', width: '190px' },
]

const ip = ref('')
const userId = ref('')
const status = ref('')
const path = ref('')
const page = ref(1)
const size = ref(20)
const rows = ref([])
const total = ref(0)
const loading = ref(true)
const errorMessage = ref('')

let timer = null
let requestSeq = 0

// 只有筛选字段参与「变筛选就回第一页」；page / size 变化不该重置页码
const filterKey = computed(() =>
  JSON.stringify([ip.value.trim(), userId.value.trim(), status.value, path.value.trim()]),
)

const query = computed(() => ({
  ip: ip.value.trim(),
  userId: userId.value.trim(),
  status: status.value,
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
      // 改筛选后停在旧页码会看到空列表；写回第 1 页由下一次 watch 触发加载
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
    const data = await fetchAccessLogs({
      page: current.page,
      size: current.size,
      ip: current.ip,
      userId: current.userId,
      status: current.status,
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
  userId.value = ''
  status.value = ''
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
    min-width="1080px"
    :note="`共 ${formatCount(total)} 条访问记录`"
    empty-title="没有匹配的访问记录"
    empty-description="换个时间范围，或清空筛选再试"
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
        v-model="userId"
        class="filter-input"
        aria-label="按用户筛选"
        placeholder="用户 dataKey"
      />
      <DropdownSelect
        v-model="status"
        :options="ACCESS_STATUS_OPTIONS"
        aria-label="按状态码筛选"
        align="end"
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

    <template #cell-request="{ row }">
      <span class="cell-main request">
        <span class="method">{{ row.method }}</span>
        <span class="path" :title="row.path">{{ row.path }}</span>
      </span>
    </template>

    <template #cell-status="{ row }">
      <span class="num" :class="logStatusTone(row.statusCode)">{{ row.statusCode }}</span>
    </template>

    <template #cell-duration="{ row }">
      <span class="num" :class="{ 'is-warning': row.durationMs >= SLOW_MS }">
        {{ row.durationMs }} ms
      </span>
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

    <template #cell-requestId="{ row }">
      <span class="request-id">
        <span class="mono" :title="row.requestId">{{ row.requestId || '—' }}</span>
        <CopyButton :value="row.requestId" label="请求 ID" />
      </span>
    </template>
  </LogsTable>
</template>

<style scoped>
.filter-input {
  width: 168px;
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

/* 路径可能带 query，表格里截断，悬浮看全文 */
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

@media (max-width: 767px) {
  .filter-input {
    width: 100%;
  }
}
</style>
