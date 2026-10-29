<script setup>
/**
 * 用户台账
 *
 * 用途：`/admin/users` 只读列表——搜索、排序、每页数量、分页全部同步到 URL，
 *       刷新与从详情返回都保持现场。
 * 用法：路由 `/admin/users`；行点击进入 `/admin/users/:dataKey`。
 *
 * 约定：
 *   - 列表手机号已由后端脱敏；三档已知词只在详情接口（md/40 §10 第 2 条）
 *   - 错误时保留上一次数据并置灰（stale-while-revalidate），不清空表格
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../component/BaseButton.vue'
import BaseInput from '../../component/BaseInput.vue'
import DropdownSelect from '../../component/DropdownSelect.vue'
import EmptyState from '../../component/EmptyState.vue'
import PaginationBar from '../../component/PaginationBar.vue'
import AdminStatePill from '../component/AdminStatePill.vue'
import AdminTable from '../component/AdminTable.vue'
import { fetchAdminUsers } from '../api/users'
import { formatCount, formatDate, formatQuota, formatTime, formatTokens } from '../format'

const SEARCH_DEBOUNCE_MS = 300

const SORT_OPTIONS = [
  { value: 'createdAt', label: '注册时间' },
  { value: 'lastLoginAt', label: '最近登录' },
  { value: 'tokens', label: 'token 消耗' },
  { value: 'readings', label: '文章数' },
]

const SIZE_OPTIONS = [
  { value: 20, label: '20 条/页' },
  { value: 50, label: '50 条/页' },
  { value: 100, label: '100 条/页' },
]

// 空字符串代表不过滤；只给后端明确支持的两个值，避免 400
const API_KEY_FILTER_OPTIONS = [
  { value: '', label: '自备 Key：全部' },
  { value: 'true', label: '只看已接入' },
  { value: 'false', label: '只看未接入' },
]

const COLUMNS = [
  { key: 'user', label: '用户' },
  { key: 'phone', label: '手机号' },
  { key: 'vocabulary', label: '词库' },
  { key: 'readings', label: '文章' },
  { key: 'accuracy', label: '正确率' },
  { key: 'tokens', label: 'token' },
  { key: 'failures', label: '失败' },
  { key: 'quota', label: '今日额度' },
  { key: 'createdAt', label: '注册时间' },
  { key: 'lastLoginAt', label: '最近登录' },
]

const route = useRoute()
const router = useRouter()

/** URL 是唯一数据源；非法值回落到默认，避免手改地址把页面打空 */
function normalizeQuery(raw) {
  const q = typeof raw.q === 'string' ? raw.q : ''
  const page = Math.max(1, Number.parseInt(raw.page, 10) || 1)
  const size = SIZE_OPTIONS.some((option) => option.value === Number(raw.size))
    ? Number(raw.size)
    : 20
  const sort = SORT_OPTIONS.some((option) => option.value === raw.sort) ? raw.sort : 'createdAt'
  const hasApiKey = raw.hasApiKey === 'true' || raw.hasApiKey === 'false' ? raw.hasApiKey : ''

  return { q, page, size, sort, hasApiKey }
}

/** 只写非默认值，地址栏保持干净 */
function toRouteQuery(params) {
  const query = {}
  if (params.q) query.q = params.q
  if (params.page > 1) query.page = String(params.page)
  if (params.size !== 20) query.size = String(params.size)
  if (params.sort !== 'createdAt') query.sort = params.sort
  if (params.hasApiKey) query.hasApiKey = params.hasApiKey
  return query
}

const params = computed(() => normalizeQuery(route.query))
const keyword = ref(params.value.q)
const rows = ref([])
const total = ref(0)
const loading = ref(true)
const errorMessage = ref('')

let searchTimer = null
let requestSeq = 0
// 搜索框与 URL 的 q 各自更新：记住最近一次由本页写入的 q，避免回写时把正在输入的内容清掉
let syncedKeyword = params.value.q

const sort = computed({
  get: () => params.value.sort,
  set: (value) => applyQuery({ sort: value, page: 1 }),
})

const size = computed({
  get: () => params.value.size,
  set: (value) => applyQuery({ size: Number(value), page: 1 }),
})

const page = computed({
  get: () => params.value.page,
  set: (value) => applyQuery({ page: value }),
})

const apiKeyFilter = computed({
  get: () => params.value.hasApiKey,
  set: (value) => applyQuery({ hasApiKey: value, page: 1 }),
})

function applyQuery(patch) {
  const next = { ...params.value, ...patch }
  const nextQuery = toRouteQuery(next)

  // 值没变就不写 URL，避免同一次筛选触发两次请求
  if (JSON.stringify(nextQuery) === JSON.stringify(toRouteQuery(params.value))) return

  if ('q' in patch) syncedKeyword = next.q
  router.replace({ name: 'admin-users', query: nextQuery })
}

async function load(current) {
  const seq = requestSeq + 1
  requestSeq = seq
  loading.value = true
  errorMessage.value = ''

  try {
    const data = await fetchAdminUsers(current)
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

watch(
  params,
  (next) => {
    if (next.q !== syncedKeyword) {
      syncedKeyword = next.q
      keyword.value = next.q
    }
    load(next)
  },
  { immediate: true },
)

watch(keyword, (value) => {
  if (value.trim() === params.value.q) return

  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => applyQuery({ q: value.trim(), page: 1 }), SEARCH_DEBOUNCE_MS)
})

function runSearchNow() {
  clearTimeout(searchTimer)
  applyQuery({ q: keyword.value.trim(), page: 1 })
}

function resetFilters() {
  clearTimeout(searchTimer)
  keyword.value = ''
  applyQuery({ q: '', page: 1, sort: 'createdAt', size: 20, hasApiKey: '' })
}

function openUser(row) {
  router.push({ name: 'admin-user', params: { dataKey: row.dataKey } })
}

function userSubLabel(row) {
  return row.nickname === row.username ? row.dataKey : `@${row.username} · ${row.dataKey}`
}

function accuracyTone(row) {
  if (!row.questions?.answered) return 'is-muted'
  if (row.questions.accuracy >= 80) return 'is-success'
  if (row.questions.accuracy < 60) return 'is-warning'
  return ''
}

function quotaTone(row) {
  if (!row.quota?.enabled) return 'is-muted'
  return row.quota.remaining === 0 ? 'is-warning' : ''
}

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
})
</script>

<template>
  <section class="users">
    <div class="toolbar">
      <p class="toolbar-note">共 {{ formatCount(total) }} 位用户</p>

      <div class="filters">
        <BaseInput
          v-model="keyword"
          class="search"
          aria-label="搜索用户"
          placeholder="用户名 / 昵称 / 手机号"
          @keydown.enter.prevent="runSearchNow"
        />
        <DropdownSelect
          v-model="apiKeyFilter"
          :options="API_KEY_FILTER_OPTIONS"
          aria-label="自备 Key 筛选"
          align="end"
        />
        <DropdownSelect v-model="sort" :options="SORT_OPTIONS" aria-label="排序方式" align="end" />
        <DropdownSelect v-model="size" :options="SIZE_OPTIONS" aria-label="每页数量" align="end" />
      </div>
    </div>

    <div v-if="errorMessage" class="error-strip" role="alert">
      <span>{{ errorMessage }}</span>
      <button type="button" class="error-action" @click="load(params)">重试</button>
    </div>

    <!-- 首屏失败时只留错误条：空态文案「没有匹配的用户」会把加载失败说成没有数据 -->
    <div
      v-if="rows.length || loading || !errorMessage"
      :class="{ 'is-stale': errorMessage && rows.length }"
    >
      <AdminTable
        :columns="COLUMNS"
        :rows="rows"
        row-key="dataKey"
        :loading="loading"
        clickable
        @row-click="openUser"
      >
        <template #cell-user="{ row }">
          <span class="cell-main">{{ row.nickname }}</span>
          <span class="cell-sub user-sub">
            <span>{{ userSubLabel(row) }}</span>
            <!-- hasKey=false 不显示徽标：整列「未接入」只会变成噪音 -->
            <AdminStatePill
              v-if="row.apiKey?.hasKey"
              class="api-key-pill"
              kind="api-key"
              :value="row.apiKey.status"
            />
          </span>
        </template>

        <template #cell-phone="{ row }">
          <span v-if="row.phone">{{ row.phone }}</span>
          <span v-else class="is-muted">未填写</span>
        </template>

        <template #cell-vocabulary="{ row }">
          <span class="num">{{ formatCount(row.vocabulary?.personalWords) }}</span>
        </template>

        <template #cell-readings="{ row }">
          <span class="cell-main num">{{ formatCount(row.readings?.generated) }}</span>
          <span class="cell-sub">
            完成 {{ formatCount(row.readings?.completed) }} · 今日
            {{ formatCount(row.readings?.today) }}
          </span>
        </template>

        <template #cell-accuracy="{ row }">
          <span :class="accuracyTone(row)" class="num">
            {{ row.questions?.answered ? `${row.questions.accuracy}%` : '—' }}
          </span>
        </template>

        <template #cell-tokens="{ row }">
          <span class="cell-main num" :title="formatCount(row.tokens?.total)">
            {{ formatTokens(row.tokens?.total) }}
          </span>
          <span v-if="row.tokens?.failed > 0" class="cell-sub is-warning">
            失败 {{ formatTokens(row.tokens.failed) }}
          </span>
        </template>

        <template #cell-failures="{ row }">
          <span v-if="row.failures?.count" class="is-warning num">
            {{ formatCount(row.failures.count) }}
          </span>
          <span v-else class="is-muted">—</span>
        </template>

        <template #cell-quota="{ row }">
          <span :class="quotaTone(row)" class="num">{{ formatQuota(row.quota) }}</span>
        </template>

        <template #cell-createdAt="{ row }">
          <span class="cell-main num">{{ formatDate(row.createdAt) }}</span>
          <span class="cell-sub num">{{ formatTime(row.createdAt) }}</span>
        </template>

        <template #cell-lastLoginAt="{ row }">
          <template v-if="row.lastLoginAt">
            <span class="cell-main num">{{ formatDate(row.lastLoginAt) }}</span>
            <span class="cell-sub num">{{ formatTime(row.lastLoginAt) }}</span>
          </template>
          <span v-else class="is-muted">从未登录</span>
        </template>

        <template #empty>
          <EmptyState title="没有匹配的用户" description="换个关键词，或清空筛选试试">
            <template #actions>
              <BaseButton variant="secondary" @click="resetFilters">清空筛选</BaseButton>
            </template>
          </EmptyState>
        </template>
      </AdminTable>
    </div>

    <PaginationBar
      v-if="rows.length || !errorMessage"
      v-model:page="page"
      :total="total"
      :page-size="params.size"
    />
  </section>
</template>

<style scoped>
.users {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.toolbar-note {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.search {
  width: 260px;
}

.user-sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

/* 比默认胶囊矮一档，避免用户列因为一个徽标高出一截 */
.api-key-pill {
  height: 20px;
  padding: 0 8px;
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

/* 旧数据留在屏幕上但明确变灰，告诉管理员「这不是最新的」 */
.is-stale {
  opacity: 0.55;
}

@media (max-width: 767px) {
  .filters {
    width: 100%;
  }

  .search {
    width: 100%;
  }
}
</style>
