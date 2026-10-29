<script setup>
/**
 * 登录记录面板
 *
 * 用途：`/admin/logs?tab=logins`——谁在什么 IP、什么时候登录成功或失败。
 *       登录 IP 只在这张表里：登录请求进来时还没有令牌，访问日志的 userId 是空的；
 *       失败记录是排查撞库最重要的线索（md/53 §10.2）。
 * 用法：<LoginLogsPanel :range="range" :reload-token="token" />，由 Logs.vue 持有时间范围。
 *
 * 约定：
 *   - `username` 包含匹配，`ip` / `userId` 精确，`role` / `success` 是枚举
 *   - 失败行整行淡红：一眼能看出「这个账号最近被人试了」
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import BaseInput from '../../component/BaseInput.vue'
import DropdownSelect from '../../component/DropdownSelect.vue'
import SegmentedControl from '../../component/SegmentedControl.vue'
import LogsTable from './LogsTable.vue'
import { fetchLoginLogs } from '../api/logs'
import { LOGIN_ROLE_OPTIONS, LOGIN_SUCCESS_OPTIONS, resolveLogRange } from '../log-options'
import { formatCount, formatDate, formatTime } from '../format'

const DEBOUNCE_MS = 250

const props = defineProps({
  range: { type: String, required: true },
  reloadToken: { type: Number, default: 0 },
})

const ROLE_LABELS = { user: '用户', admin: '管理员' }

const COLUMNS = [
  { key: 'time', label: '时间', width: '120px' },
  { key: 'username', label: '用户名' },
  { key: 'role', label: '角色', width: '90px' },
  { key: 'result', label: '结果', width: '90px' },
  { key: 'user', label: '用户', width: '170px' },
  { key: 'ip', label: 'IP', width: '150px' },
  { key: 'device', label: '设备', width: '260px' },
]

const username = ref('')
const ip = ref('')
const role = ref('')
const success = ref('')
const page = ref(1)
const size = ref(20)
const rows = ref([])
const total = ref(0)
const loading = ref(true)
const errorMessage = ref('')

let timer = null
let requestSeq = 0

const filterKey = computed(() =>
  JSON.stringify([username.value.trim(), ip.value.trim(), role.value, success.value]),
)

const query = computed(() => ({
  username: username.value.trim(),
  ip: ip.value.trim(),
  role: role.value,
  success: success.value,
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
    const data = await fetchLoginLogs({
      page: current.page,
      size: current.size,
      username: current.username,
      ip: current.ip,
      role: current.role,
      success: current.success,
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
  username.value = ''
  ip.value = ''
  role.value = ''
  success.value = ''
  if (page.value !== 1) page.value = 1
}

function failedRowOf(row) {
  return row.success ? '' : 'is-login-failed'
}

function roleLabel(value) {
  return ROLE_LABELS[value] || value || '—'
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
    min-width="1180px"
    :note="`共 ${formatCount(total)} 条登录记录`"
    empty-title="没有登录记录"
    empty-description="换个时间范围，或把结果切回「全部」"
    :row-class="failedRowOf"
    @update:page="page = $event"
    @update:size="size = $event"
    @retry="load"
    @reset="resetFilters"
  >
    <template #filters>
      <BaseInput
        v-model="username"
        class="filter-input"
        aria-label="按用户名筛选"
        placeholder="用户名包含"
      />
      <BaseInput
        v-model="ip"
        class="filter-input"
        aria-label="按 IP 筛选"
        placeholder="IP 精确匹配"
      />
      <DropdownSelect
        v-model="role"
        :options="LOGIN_ROLE_OPTIONS"
        aria-label="按角色筛选"
        align="end"
      />
      <SegmentedControl
        v-model="success"
        :options="LOGIN_SUCCESS_OPTIONS"
        aria-label="按结果筛选"
      />
    </template>

    <template #cell-time="{ row }">
      <span class="cell-main num">{{ formatDate(row.createdAt) }}</span>
      <span class="cell-sub num">{{ formatTime(row.createdAt) }}</span>
    </template>

    <template #cell-username="{ row }">
      <span class="cell-main">{{ row.username || '—' }}</span>
      <!-- 失败记录的 username 是尝试值、userId 为空，副行标出来免得被当成真实账号 -->
      <span v-if="!row.success" class="cell-sub is-warning">尝试登录</span>
    </template>

    <template #cell-role="{ row }">
      <span>{{ roleLabel(row.role) }}</span>
    </template>

    <template #cell-result="{ row }">
      <span :class="row.success ? 'is-success' : 'is-warning'">
        {{ row.success ? '成功' : '失败' }}
      </span>
    </template>

    <template #cell-user="{ row }">
      <RouterLink
        v-if="row.userId"
        class="user-link"
        :to="{ name: 'admin-user', params: { dataKey: row.userId } }"
      >
        {{ row.userId }}
      </RouterLink>
      <span v-else class="is-muted">—</span>
    </template>

    <template #cell-ip="{ row }">
      <span>{{ row.ip || '—' }}</span>
    </template>

    <template #cell-device="{ row }">
      <span class="device" :title="row.userAgent">{{ row.userAgent || '—' }}</span>
    </template>
  </LogsTable>
</template>

<style scoped>
.filter-input {
  width: 168px;
}

.user-link {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.device {
  display: block;
  overflow: hidden;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 失败尝试整行淡红；日志行不可点击，不会和 hover 底色打架 */
:deep(tr.is-login-failed) {
  background: var(--color-danger-bg);
}

@media (max-width: 767px) {
  .filter-input {
    width: 100%;
  }
}
</style>
