<script setup>
/**
 * 历史记录视图
 * 组合统计卡、难度筛选、记录表/移动端列表与分页；点击记录进入结果页或继续答题。
 * 统计取自接口 stats（全量），未提交记录不展示判分；请求用序号隔离，避免快速切换筛选时旧响应覆盖新数据。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../../component/BaseButton.vue'
import DropdownSelect from '../../component/DropdownSelect.vue'
import EmptyState from '../../component/EmptyState.vue'
import PaginationBar from '../../component/PaginationBar.vue'
import StatsGrid from './component/StatsGrid.vue'
import HistoryTable from './component/HistoryTable.vue'
import HistoryMobileList from './component/HistoryMobileList.vue'
import { fetchHistory } from '../../api/readings'
import { normalizeApiError } from '../../errors'

const PAGE_SIZE = 10

const LEVEL_OPTIONS = [
  { value: 'all', label: '全部难度' },
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '进阶' },
  { value: 'hard', label: '挑战' },
]

const router = useRouter()

const level = ref('all')
const page = ref(1)
const items = ref([])
const total = ref(0)
const stats = ref(null)
// 挂载即请求，初值设为 true 让首帧就是骨架而不是占位横线
const loading = ref(true)
const error = ref('')

let requestSeq = 0

const isFiltered = computed(() => level.value !== 'all')
const showEmpty = computed(
  () => !loading.value && !error.value && total.value === 0 && items.value.length === 0,
)

const emptyMeta = computed(() => {
  if (isFiltered.value) {
    return {
      title: '该难度下暂无记录',
      description: '查看全部难度，或换一个难度再试。',
      actionText: '查看全部难度',
    }
  }

  return {
    title: '还没有练习记录',
    description: '完成第一次阅读后，这里会记录你的进步。',
    actionText: '开始阅读',
  }
})

onMounted(load)

onBeforeUnmount(() => {
  // 卸载后到达的响应直接作废，避免继续写入已销毁页面
  requestSeq += 1
})

async function load() {
  const current = (requestSeq += 1)
  loading.value = true
  error.value = ''

  try {
    const data = await fetchHistory({
      level: level.value,
      page: page.value,
      pageSize: PAGE_SIZE,
    })

    if (current !== requestSeq) return

    items.value = Array.isArray(data?.items) ? data.items : []
    total.value = Math.max(0, Number(data?.total) || 0)
    stats.value = data?.stats || null

    // 后端在页码越界时会收敛到有效页，这里同步真实页码
    const resolvedPage = Number(data?.page)
    if (Number.isInteger(resolvedPage) && resolvedPage > 0 && resolvedPage !== page.value) {
      page.value = resolvedPage
    }
  } catch (caught) {
    if (current !== requestSeq) return

    const normalized = normalizeApiError(caught)
    error.value = normalized?.message || '网络出了点问题，请稍后重试。'
    items.value = []
    total.value = 0
  } finally {
    if (current === requestSeq) loading.value = false
  }
}

function changeLevel(value) {
  if (value === level.value) return
  level.value = value
  page.value = 1
  load()
}

function changePage(value) {
  const next = Number(value)
  if (!Number.isInteger(next) || next === page.value) return
  page.value = next
  load()
}

function openItem(item) {
  if (!item?.id) return
  const target = item.status === 'submitted' ? 'reading-result' : 'reading'
  router.push({ name: target, params: { id: item.id } })
}

function handleEmptyAction() {
  if (isFiltered.value) {
    changeLevel('all')
    return
  }
  router.push('/settings')
}
</script>

<template>
  <section class="history-page">
    <header class="history-head">
      <div class="head-copy">
        <p class="page-eyebrow">History</p>
        <h1 class="page-title">历史记录</h1>
        <p class="page-desc">查看你的练习记录与战绩，见证你的进步。</p>
      </div>

      <DropdownSelect
        class="head-filter"
        :model-value="level"
        :options="LEVEL_OPTIONS"
        aria-label="按难度筛选"
        @update:model-value="changeLevel"
      />
    </header>

    <StatsGrid class="history-stats" :stats="stats" :loading="loading && !stats" />

    <section
      class="history-list"
      aria-labelledby="history-list-title"
      :aria-busy="loading ? 'true' : 'false'"
    >
      <span v-if="loading" class="sr-only" role="status">正在加载历史记录</span>

      <div class="list-head">
        <h2 id="history-list-title" class="list-title">练习记录</h2>
        <span v-if="!loading && !error && total > 0" class="list-count">共 {{ total }} 条</span>
      </div>

      <div v-if="error" class="state-card" role="alert">
        <p class="state-title">历史记录加载失败</p>
        <p class="state-desc">{{ error }}</p>
        <BaseButton variant="secondary" :loading="loading" @click="load">重试</BaseButton>
      </div>

      <EmptyState
        v-else-if="showEmpty"
        class="history-empty"
        :title="emptyMeta.title"
        :description="emptyMeta.description"
        :action-text="emptyMeta.actionText"
        @action="handleEmptyAction"
      />

      <template v-else>
        <HistoryTable :items="items" :loading="loading" @open="openItem" />
        <HistoryMobileList :items="items" :loading="loading" @open="openItem" />

        <div v-if="!loading && total > 0" class="list-footer">
          <p class="total-text">共 {{ total }} 条</p>
          <PaginationBar
            :page="page"
            :total="total"
            :page-size="PAGE_SIZE"
            @update:page="changePage"
          />
        </div>
      </template>
    </section>
  </section>
</template>

<style scoped>
.history-head {
  position: relative;
  /* 入场动画停在 translateY(0) 仍会建立层叠上下文；抬高一层，否则下拉菜单被统计卡盖住 */
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  animation: history-rise var(--dur-page) var(--ease-out) both;
}

.head-copy {
  min-width: 0;
}

.head-filter {
  flex-shrink: 0;
}

.history-stats {
  margin-top: var(--space-6);
  animation: history-rise var(--dur-page) var(--ease-out) 40ms both;
}

.history-list {
  margin-top: var(--space-8);
  animation: history-rise var(--dur-page) var(--ease-out) 60ms both;
}

.list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.list-title {
  font-family: var(--font-display);
  font-size: var(--text-section);
  line-height: var(--leading-section);
  letter-spacing: 0.02em;
}

.list-count {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.history-empty {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-10) var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  text-align: center;
}

.state-title {
  color: var(--color-ink-2);
  font-size: 16px;
  font-weight: 500;
  line-height: 26px;
}

.state-desc {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  overflow-wrap: anywhere;
}

.list-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-top: var(--space-4);
}

.total-text {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

@keyframes history-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 767px) {
  .history-head {
    align-items: stretch;
    flex-direction: column;
  }

  .head-filter,
  .head-filter :deep(.dropdown),
  .head-filter :deep(.dropdown-trigger) {
    width: 100%;
  }

  .history-list {
    margin-top: var(--space-6);
  }

  .list-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .history-head,
  .history-stats,
  .history-list {
    animation: none;
  }
}
</style>
