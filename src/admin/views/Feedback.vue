<script setup>
/**
 * 用户反馈列表
 *
 * 用途：`/admin/feedback`——按状态 / 分类筛选，只展示前 80 字摘要，
 *       全文与设备信息在详情页。
 * 用法：路由 `/admin/feedback`；行点击进入 `/admin/feedback/:id`。
 *
 * 隐私：列表里的 phone 是提交时的明文快照，展示前必须遮中间四位（md/40 §10 第 6 条）。
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../component/BaseButton.vue'
import DropdownSelect from '../../component/DropdownSelect.vue'
import EmptyState from '../../component/EmptyState.vue'
import PaginationBar from '../../component/PaginationBar.vue'
import SegmentedControl from '../../component/SegmentedControl.vue'
import AdminTable from '../component/AdminTable.vue'
import AdminStatePill from '../component/AdminStatePill.vue'
import { fetchAdminFeedback } from '../api/feedback'
import {
  FEEDBACK_CATEGORY_OPTIONS,
  contactLabel,
  feedbackCategoryLabel,
  formatCount,
  formatDate,
  formatTime,
  submitterLabel,
} from '../format'

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'open', label: '待处理' },
  { value: 'replied', label: '已回复' },
  { value: 'closed', label: '已关闭' },
]

const COLUMNS = [
  { key: 'status', label: '状态' },
  { key: 'category', label: '分类' },
  { key: 'excerpt', label: '摘要' },
  { key: 'submitter', label: '提交人' },
  { key: 'contact', label: '联系方式' },
  { key: 'page', label: '页面' },
  { key: 'createdAt', label: '提交时间' },
]

const PAGE_SIZE = 20

const route = useRoute()
const router = useRouter()

function normalizeQuery(raw) {
  const status = STATUS_OPTIONS.some((option) => option.value === raw.status) ? raw.status : ''
  const category = FEEDBACK_CATEGORY_OPTIONS.some((option) => option.value === raw.category)
    ? raw.category
    : ''
  const page = Math.max(1, Number.parseInt(raw.page, 10) || 1)

  return { status, category, page }
}

function toRouteQuery(params) {
  const query = {}
  if (params.status) query.status = params.status
  if (params.category) query.category = params.category
  if (params.page > 1) query.page = String(params.page)
  return query
}

const params = computed(() => normalizeQuery(route.query))
const rows = ref([])
const total = ref(0)
const loading = ref(true)
const errorMessage = ref('')

let requestSeq = 0

const status = computed({
  get: () => params.value.status,
  set: (value) => applyQuery({ status: value, page: 1 }),
})

const category = computed({
  get: () => params.value.category,
  set: (value) => applyQuery({ category: value, page: 1 }),
})

const page = computed({
  get: () => params.value.page,
  set: (value) => applyQuery({ page: value }),
})

function applyQuery(patch) {
  const next = { ...params.value, ...patch }
  const nextQuery = toRouteQuery(next)
  if (JSON.stringify(nextQuery) === JSON.stringify(toRouteQuery(params.value))) return

  router.replace({ name: 'admin-feedback', query: nextQuery })
}

async function load(current) {
  const seq = requestSeq + 1
  requestSeq = seq
  loading.value = true
  errorMessage.value = ''

  try {
    const data = await fetchAdminFeedback({ ...current, size: PAGE_SIZE })
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

watch(params, (next) => load(next), { immediate: true })

function openFeedback(row) {
  router.push({ name: 'admin-feedback-detail', params: { id: row.id } })
}

function resetFilters() {
  applyQuery({ status: '', category: '', page: 1 })
}

/** 副行只在 userId 有辨识度时显示；匿名占位与显示名相同都不重复 */
function submitterSub(row) {
  if (!row.userId || row.userId === 'anonymous') return ''
  return row.userId === submitterLabel(row) ? '' : row.userId
}
</script>

<template>
  <section class="feedback">
    <div class="toolbar">
      <p class="toolbar-note">共 {{ formatCount(total) }} 条</p>

      <div class="filters">
        <SegmentedControl v-model="status" :options="STATUS_OPTIONS" aria-label="按状态筛选" />
        <DropdownSelect
          v-model="category"
          :options="FEEDBACK_CATEGORY_OPTIONS"
          aria-label="按分类筛选"
          align="end"
        />
      </div>
    </div>

    <div v-if="errorMessage" class="error-strip" role="alert">
      <span>{{ errorMessage }}</span>
      <button type="button" class="error-action" @click="load(params)">重试</button>
    </div>

    <!-- 首屏失败时只留错误条，避免空态把「加载失败」说成「没有反馈」 -->
    <div
      v-if="rows.length || loading || !errorMessage"
      :class="{ 'is-stale': errorMessage && rows.length }"
    >
      <AdminTable
        :columns="COLUMNS"
        :rows="rows"
        :loading="loading"
        clickable
        @row-click="openFeedback"
      >
        <template #cell-status="{ row }">
          <AdminStatePill kind="feedback" :value="row.status" />
        </template>

        <template #cell-category="{ row }">
          {{ feedbackCategoryLabel(row.category) }}
        </template>

        <template #cell-excerpt="{ row }">
          <span class="excerpt" :title="row.excerpt">{{ row.excerpt }}</span>
        </template>

        <template #cell-submitter="{ row }">
          <span class="cell-main">{{ submitterLabel(row) }}</span>
          <span v-if="submitterSub(row)" class="cell-sub">{{ submitterSub(row) }}</span>
        </template>

        <template #cell-contact="{ row }">
          <span :class="{ 'is-muted': contactLabel(row) === '—' }">{{ contactLabel(row) }}</span>
        </template>

        <template #cell-page="{ row }">
          <span v-if="row.page">{{ row.page }}</span>
          <span v-else class="is-muted">—</span>
        </template>

        <template #cell-createdAt="{ row }">
          <span class="cell-main num">{{ formatDate(row.createdAt) }}</span>
          <span class="cell-sub num">{{ formatTime(row.createdAt) }}</span>
        </template>

        <template #empty>
          <EmptyState title="没有符合筛选的反馈" description="换个状态或分类，或清空筛选试试。">
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
      :page-size="PAGE_SIZE"
    />
  </section>
</template>

<style scoped>
.feedback {
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

.excerpt {
  display: -webkit-box;
  overflow: hidden;
  max-width: 360px;
  color: var(--color-ink-2);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.is-stale {
  opacity: 0.55;
}
</style>
