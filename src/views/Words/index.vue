<script setup>
/**
 * 我的单词视图
 *
 * 用途：把词汇列表做成一本可以翻的词书——双页列表、详情纸页、写词纸页与拼贴模式；
 *       搜索、状态筛选、分页、增删改与批量改状态都在本页编排，请求状态由 words store 维护。
 * 用法：路由 /words
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, LayoutGrid } from 'lucide-vue-next'
import BaseButton from '../../component/BaseButton.vue'
import ConfirmDialog from '../../component/ConfirmDialog.vue'
import EmptyState from '../../component/EmptyState.vue'
import GuestMask from '../../component/GuestMask.vue'
import GuestNotice from '../../component/GuestNotice.vue'
import ReviewBanner from './component/ReviewBanner.vue'
import WordBatchBar from './component/WordBatchBar.vue'
import WordBatchImport from './component/WordBatchImport.vue'
import WordBook from './component/WordBook.vue'
import WordDetailPage from './component/WordDetailPage.vue'
import WordEditModal from './component/WordEditModal.vue'
import WordStatusTabs from './component/WordStatusTabs.vue'
import WordToolbar from './component/WordToolbar.vue'
import WordWritePage from './component/WordWritePage.vue'
import WordsSubnav from './component/WordsSubnav.vue'
import wordsBook from '../../assets/images/words-book.png'
import { useAuthGate } from '../../composables/useAuthGate'
import { useToast } from '../../composables/useToast'
import { useAuthStore } from '../../stores/model/auth'
import { useWordsStore } from '../../stores/model/words'
import { batchResultMessage, batchResultType, batchTargetLabel } from '../../unit/word-batch'
import { localStore, storageKeys } from '../../unit/storage'

const TOAST_HIGHLIGHT_DURATION = 800
const EDIT_HIGHLIGHT_DURATION = 600

const VIEW_BOOK = 'book'
const VIEW_COLLAGE = 'collage'

const toast = useToast()
const store = useWordsStore()
const router = useRouter()
const auth = useAuthStore()
const { goLogin } = useAuthGate()
// 游客可浏览页面结构，但私人词条不请求、不渲染（md/45 §5.2）
const isGuest = computed(() => !auth.isAuthenticated)

// 纸页：'' 列表 / 'write' 写词 / 'detail' 详情
const panel = ref('')
const detailItem = ref(null)
const writePage = ref(null)
// 从详情返回时把焦点还给原词条
let lastFocusId = ''

const viewMode = ref(
  localStore.get(storageKeys.wordsViewMode, VIEW_BOOK) === VIEW_COLLAGE ? VIEW_COLLAGE : VIEW_BOOK,
)

const editOpen = ref(false)
const editingWord = ref(null)
const batchOpen = ref(false)
const deleteOpen = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)
const highlightId = ref('')

// 批量选择只属于当前页面：不进 store，切标签 / 搜索 / 翻页立即清空（md/22 #115）
const selectedIds = ref(new Set())
const batchTarget = ref('')
const batching = ref(false)
const batchConfirmOpen = ref(false)
const batchConfirmTarget = ref('')

const selectedIdList = computed(() => [...selectedIds.value])

const batchConfirmTitle = computed(() => {
  const count = selectedIds.value.size
  if (batchConfirmTarget.value === 'removed') return `把选中的 ${count} 个词标为「已排除」？`
  return `把选中的 ${count} 个词标为「已掌握」？`
})

const batchConfirmDescription = computed(() =>
  batchConfirmTarget.value === 'removed'
    ? '标为已排除后，这些词不会用于生成文章；可在「已排除」书签里恢复。'
    : '已掌握的词会退出复习队列，不再出现在今日复习里。',
)

const batchConfirmText = computed(() => `标为${batchTargetLabel(batchConfirmTarget.value)}`)

let highlightTimer = null

// 标签页绑的是后端的 `study`（studyState 口径），不是 `status`
const statusModel = computed({
  get: () => store.study,
  set: (value) => {
    if (isGuest.value) {
      goLogin('/words')
      return
    }
    rememberEmptyView()
    store.filterByStudy(value)
  },
})

const allWordsLabel = computed(() => {
  if (store.studyCounts) return store.studyCounts.all
  return store.loading ? '—' : store.total
})

// 已经有成功结果、但当前没有单词时展示空态。
// 加载中也保持显示：从空态切到别的筛选时，旧的空态先留在原位，
// 新结果到达后直接换成列表 / 新的空态，避免「空态 → 骨架 → 空态」闪一下。
const showEmpty = computed(() => store.hasLoaded && !store.error && !store.hasItems)
const emptyActionVariant = computed(() => (store.isFiltered ? 'ghost' : 'primary'))

const emptyMeta = computed(() => {
  if (store.query) {
    return {
      action: 'search',
      title: '没有找到匹配的单词',
      description: '换个关键词试试，或清除搜索。',
      actionText: '清除搜索',
      image: '',
    }
  }

  // 「已排除」不是学习状态，空态也要说清楚它是排除标记，而不是「没学过」
  if (store.study === 'removed') {
    return {
      action: 'status',
      title: '还没有已排除的词',
      description: '标为「不认识」的基础词会出现在这里，生成文章时不再使用。',
      actionText: '查看全部',
      image: '',
    }
  }

  if (store.study !== 'all') {
    return {
      action: 'status',
      title: '这个状态下还没有单词',
      description: '切换其他状态，或查看全部单词。',
      actionText: '查看全部',
      image: '',
    }
  }

  return {
    action: 'add',
    title: '还没有单词',
    description: '先写入第一个单词，开始你的阅读训练。',
    actionText: '写入新词',
    image: wordsBook,
  }
})

// 空态上的一次点击已经开始请求新数据时，按钮与文案先保持点击前的样子：
// 否则「清除搜索」会把空态立刻换成「还没有单词」，数据回来又换成列表，文案闪两下。
const emptySnapshot = ref(null)

const emptyView = computed(() => {
  if (store.loading && emptySnapshot.value) return emptySnapshot.value
  return { ...emptyMeta.value, variant: emptyActionVariant.value }
})

/** 在改变查询条件之前记下当前空态（即用户此刻看到的内容），供请求期间继续展示 */
function rememberEmptyView() {
  if (!showEmpty.value) return
  emptySnapshot.value = { ...emptyView.value }
}

const deleteTitle = computed(() =>
  deleteTarget.value ? `删除 “${deleteTarget.value.word}”？` : '删除这个单词？',
)

watch(viewMode, (value) => {
  localStore.set(storageKeys.wordsViewMode, value)
})

// 换筛选 / 翻页后原来的选择失效；详情纸页在筛选变化时收起
watch(
  () => [store.query, store.study],
  () => {
    closeDetail()
    clearSelection()
    batchTarget.value = ''
  },
)

watch(
  () => store.page,
  () => {
    clearSelection()
    batchTarget.value = ''
  },
)

// 编辑后列表快照会替换，详情纸页跟着换成新数据；词离开当前筛选时退回列表
watch(
  () => store.items,
  (items) => {
    if (panel.value !== 'detail' || !detailItem.value) return
    const next = items.find((item) => item.id === detailItem.value.id)
    if (!next) {
      closeDetail()
      return
    }
    detailItem.value = next
  },
)

onMounted(() => {
  if (isGuest.value) return
  store.fetchList()
  // 复习入口不是关键路径：失败时 store 里保持 null，入口条自己隐藏
  store.loadDailyPlan()
})

// 登录态变化：掉线清掉私人列表、立刻切遮罩；登录成功原地补拉
watch(isGuest, (guest) => {
  closeDetail()
  clearSelection()
  if (guest) {
    store.reset()
    return
  }
  store.fetchList()
  store.loadDailyPlan()
})

onBeforeUnmount(() => {
  if (highlightTimer) clearTimeout(highlightTimer)
})

function flashRow(id, duration) {
  if (!id) return
  highlightId.value = id
  if (highlightTimer) clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => {
    highlightId.value = ''
    highlightTimer = null
  }, duration)
}

function handleSearch(value) {
  if (isGuest.value) {
    goLogin('/words')
    return
  }
  rememberEmptyView()
  store.search(value)
}

function clearSelection() {
  selectedIds.value = new Set()
}

function handleSelect({ id, selected }) {
  const next = new Set(selectedIds.value)
  if (selected) next.add(id)
  else next.delete(id)
  selectedIds.value = next
}

/** 全选只作用于当前这一摊；其他页已选中的 id 原样保留 */
function handleSelectAll(selected) {
  const next = new Set(selectedIds.value)
  store.items.forEach((item) => {
    if (selected) next.add(item.id)
    else next.delete(item.id)
  })
  selectedIds.value = next
}

/* ---------------- 纸页切换 ---------------- */

async function openWritePanel() {
  if (isGuest.value) {
    goLogin('/words')
    return
  }
  closeDetail()
  panel.value = 'write'
  await nextTick()
  writePage.value?.focusWord()
}

function openDetail(item) {
  if (isGuest.value) {
    goLogin('/words')
    return
  }
  lastFocusId = item.id
  detailItem.value = item
  panel.value = 'detail'
}

function closePanel() {
  panel.value = ''
  detailItem.value = null
}

async function closeDetail() {
  if (panel.value !== 'detail') return
  panel.value = ''
  detailItem.value = null

  await nextTick()
  if (!lastFocusId) return
  document.querySelector(`[data-entry-id="${lastFocusId}"] .entry-word`)?.focus()
  lastFocusId = ''
}

/* ---------------- 批量 ---------------- */

/** 会退出复习队列 / 影响生成用词的目标先二次确认，普通改状态直接提交 */
function requestBatch(target) {
  if (batching.value || selectedIds.value.size === 0 || !target) return

  if (target === 'removed' || target === 'mastered') {
    batchConfirmTarget.value = target
    batchConfirmOpen.value = true
    return
  }

  submitBatch(target)
}

async function submitBatch(target) {
  if (batching.value) return

  const ids = [...selectedIds.value]
  if (ids.length === 0) return

  batching.value = true
  const result = await store.batchUpdateStatus(ids, target)
  batching.value = false

  if (!result.ok) {
    toast.error(result.message)
    return
  }

  toast[batchResultType(result)](batchResultMessage(result))
  if (panel.value === 'detail') closeDetail()
  clearSelection()
}

function confirmBatch() {
  const target = batchConfirmTarget.value
  batchConfirmOpen.value = false
  if (target) submitBatch(target)
}

function backToAll() {
  rememberEmptyView()
  store.filterByStudy('all')
}

/* ---------------- 其他入口 ---------------- */

function openBatchPanel() {
  if (isGuest.value) {
    goLogin('/words')
    return
  }
  batchOpen.value = true
}

function clearSearch() {
  rememberEmptyView()
  store.search('')
}

function handleEmptyAction() {
  // 按用户看到的空态按钮动作，而不是按已经变化但还没返回的查询条件
  const action = emptyView.value.action

  if (action === 'search') {
    clearSearch()
    return
  }
  if (action === 'status') {
    backToAll()
    return
  }
  openWritePanel()
}

// 添加与合并共用同一个接口，用 action 告诉用户这次到底发生了什么：
// 重复词被合并时如果仍提示「已添加」，用户会以为词库里多了一条。
const ADD_MESSAGES = {
  created: (word) => ['success', `已添加 ${word}`],
  reactivated: (word) => ['success', `已恢复 ${word}`],
  updated: (word) => ['success', `已更新 ${word} 的学习状态`],
  enriched: (word) => ['success', `已补全 ${word} 的释义`],
  kept: (word) => ['info', `词库里已经有 ${word}，这次未改动`],
}

async function handleAdd(payload) {
  const result = await store.addWord(payload)

  if (!result.ok) {
    if (!Object.keys(result.errors || {}).length) toast.error(result.message)
    return result
  }

  const word = result.item.word
  const [level, message] = (ADD_MESSAGES[result.action] || ADD_MESSAGES.created)(word)
  toast[level](message)

  if (result.action !== 'kept') flashRow(result.item.id, TOAST_HIGHLIGHT_DURATION)
  return { ok: true }
}

/** AI 整理缺 Key / Key 失效：关掉弹窗，带用户去个人中心导入 */
function handleApiKeyNeeded() {
  batchOpen.value = false
  router.push('/profile')
}

function handleBatchImported(result) {
  const parts = []
  if (result.created) parts.push(`新增 ${result.created} 个`)
  if (result.updated) parts.push(`更新 ${result.updated} 个`)
  if (result.skipped) parts.push(`跳过 ${result.skipped} 个`)
  if (result.failed) parts.push(`未导入 ${result.failed} 个`)

  const message = parts.length ? `批量导入完成：${parts.join('，')}` : '批量导入完成'
  if (result.failed) toast.info(message)
  else toast.success(message)
}

async function handleUpdate(id, patch) {
  const result = await store.updateWord(id, patch)

  if (!result.ok) {
    if (!Object.keys(result.errors || {}).length) toast.error(result.message)
    return result
  }

  if (panel.value === 'detail') detailItem.value = result.item
  toast.success(`已更新 ${result.item.word}`)
  flashRow(result.item.id, EDIT_HIGHLIGHT_DURATION)
  return { ok: true }
}

function openEdit(item) {
  editingWord.value = item
  editOpen.value = true
}

function askDelete(item) {
  deleteTarget.value = item
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value || deleting.value) return

  const target = deleteTarget.value
  deleting.value = true
  const result = await store.removeWord(target.id)
  deleting.value = false
  deleteOpen.value = false

  if (result.ok) {
    toast.success(`已删除 ${result.item.word || target.word}`)
    closePanel()
  } else {
    toast.error(result.message)
  }

  deleteTarget.value = null
}

function reload() {
  store.fetchList()
}

function goPrev() {
  if (store.page <= 1) return
  store.goToPage(store.page - 1)
}

function goNext() {
  if (store.page * store.pageSize >= store.total) return
  store.goToPage(store.page + 1)
}
</script>

<template>
  <section class="words-page">
    <header class="page-head">
      <div class="head-text">
        <p class="page-eyebrow">Vocabulary</p>
        <h1 class="page-title">我的单词</h1>
        <p class="page-desc">
          你已累计
          <strong class="count-accent">
            <GuestMask v-if="isGuest" mode="number" />
            <template v-else>{{ allWordsLabel }}</template>
          </strong>
          个单词
        </p>
      </div>
      <WordsSubnav />
    </header>

    <!-- 游客不请求 daily-plan，入口条保持隐藏 -->
    <ReviewBanner
      v-if="!isGuest"
      :remaining="store.dailyPlan?.review?.remaining ?? null"
      :today="store.dailyPlan?.review?.today ?? 0"
      :done="store.dailyPlan?.review?.doneToday ?? 0"
    />

    <div class="book-frame" :aria-busy="store.loading ? 'true' : 'false'">
      <span v-if="store.loading" class="sr-only" role="status">正在加载生词本</span>

      <!-- 列表：工具行 + 索引 + 书页 -->
      <template v-if="panel === ''">
        <WordToolbar
          :value="store.query"
          :search-disabled="isGuest"
          @search="handleSearch"
          @add="openWritePanel"
          @batch="openBatchPanel"
        />

        <div class="book-index">
          <WordStatusTabs v-model="statusModel" :counts="store.studyCounts" :disabled="isGuest" />

          <div class="view-switch" role="group" aria-label="列表形态">
            <button
              type="button"
              class="view-option"
              :class="{ 'is-active': viewMode === VIEW_BOOK }"
              :aria-pressed="viewMode === VIEW_BOOK"
              @click="viewMode = VIEW_BOOK"
            >
              <BookOpen :size="14" :stroke-width="1.8" aria-hidden="true" />
              翻书模式
            </button>
            <button
              type="button"
              class="view-option"
              :class="{ 'is-active': viewMode === VIEW_COLLAGE }"
              :aria-pressed="viewMode === VIEW_COLLAGE"
              @click="viewMode = VIEW_COLLAGE"
            >
              <LayoutGrid :size="14" :stroke-width="1.8" aria-hidden="true" />
              拼贴模式
            </button>
          </div>
        </div>

        <p v-if="store.query && !isGuest" class="search-count">找到 {{ store.total }} 个单词</p>

        <!-- 「已排除」不是学习阶段，而是排除标记：解释清楚它影响的是生成用词 -->
        <p v-if="store.study === 'removed'" class="status-hint">
          已排除的词不会用于生成文章，恢复后重新可用。
          <button type="button" class="hint-link" @click="backToAll">返回全部</button>
        </p>

        <GuestNotice
          v-if="isGuest"
          class="guest-notice"
          title="登录后查看你的单词"
          @login="goLogin('/words')"
        />

        <WordBatchBar
          v-if="!isGuest"
          v-model:target="batchTarget"
          :selected-count="selectedIds.size"
          :study="store.study"
          :loading="batching"
          @apply="requestBatch"
          @clear="clearSelection"
        />

        <!-- 首次加载（还没有成功结果）才挂书页骨架；有数据时挂着等新结果；
             列表为空且已加载过时交给下面的空态 -->
        <WordBook
          v-if="isGuest || store.error || store.hasItems || !store.hasLoaded"
          :items="isGuest ? [] : store.items"
          :total="isGuest ? 0 : store.total"
          :page="store.page"
          :page-size="store.pageSize"
          :mode="viewMode"
          :loading="store.loading"
          :error="store.error"
          :masked="isGuest"
          :selectable="!isGuest && store.items.length > 0 && !store.error"
          :selected-ids="selectedIdList"
          :highlight-id="highlightId"
          :active-word="''"
          @prev="goPrev"
          @next="goNext"
          @retry="reload"
          @open="openDetail"
          @edit="openEdit"
          @remove="askDelete"
          @login="goLogin('/words')"
          @select="handleSelect"
          @select-all="handleSelectAll"
        />

        <EmptyState
          v-else-if="showEmpty"
          :title="emptyView.title"
          :description="emptyView.description"
          :image="emptyView.image"
          class="words-empty"
        >
          <template #actions>
            <BaseButton :variant="emptyView.variant" @click="handleEmptyAction">
              {{ emptyView.actionText }}
            </BaseButton>
          </template>
        </EmptyState>

        <!-- 加载中保留底栏：否则每切一次状态，页面高度都会抖一下 -->
        <div v-if="!isGuest && !store.error && store.total > 0" class="list-footer">
          <p class="total-text">共 {{ store.total }} 条</p>
          <p class="page-hint">用左右方向键也可以翻页</p>
        </div>
      </template>

      <!-- 写词纸页：常驻 DOM，切回列表再回来时输入不丢 -->
      <WordWritePage
        v-show="panel === 'write'"
        ref="writePage"
        :submit-word="handleAdd"
        @back="closePanel"
      />

      <WordDetailPage
        v-if="panel === 'detail' && detailItem"
        :item="detailItem"
        @back="closeDetail"
        @edit="openEdit"
        @remove="askDelete"
      />
    </div>

    <WordBatchImport
      v-model:open="batchOpen"
      :preview-batch="store.previewBatch"
      :submit-batch="store.importBatch"
      :extract-file="store.extractImportFile"
      @imported="handleBatchImported"
      @api-key-needed="handleApiKeyNeeded"
    />

    <WordEditModal v-model:open="editOpen" :word="editingWord" :save-word="handleUpdate" />

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="deleteTitle"
      description="历史阅读中的词汇快照不会受影响。"
      danger
      confirm-text="删除"
      :loading="deleting"
      @confirm="confirmDelete"
    />

    <ConfirmDialog
      v-model:open="batchConfirmOpen"
      :title="batchConfirmTitle"
      :description="batchConfirmDescription"
      :danger="batchConfirmTarget === 'removed'"
      :confirm-text="batchConfirmText"
      :loading="batching"
      @confirm="confirmBatch"
    />
  </section>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  animation: words-rise var(--dur-page) var(--ease-out) both;
}

.head-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.count-accent {
  color: var(--color-accent);
  font-family: var(--font-display);
  font-weight: 500;
}

.book-frame {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-6);
  animation: words-rise var(--dur-page) var(--ease-out) 60ms both;
}

.book-index {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2) var(--space-4);
  padding-top: var(--space-2);
  border-bottom: 1px solid var(--color-line);
}

.view-switch {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.view-option {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: calc(var(--radius-sm) - 1px);
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  white-space: nowrap;
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.view-option:hover {
  color: var(--color-ink);
}

.view-option.is-active {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.view-option:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}

.search-count {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

/* 游客提示条与工具栏 / 列表之间的呼吸间距 */
.guest-notice {
  margin-top: var(--space-2);
}

.status-hint {
  margin: 0;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.hint-link {
  padding: 0;
  color: var(--color-accent);
  font-size: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.words-empty {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.list-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-top: var(--space-1);
}

.total-text,
.page-hint {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

@keyframes words-rise {
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
  .page-head {
    flex-direction: column;
    gap: var(--space-3);
  }

  .book-frame {
    gap: var(--space-3);
    margin-top: var(--space-5);
  }

  .book-index {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .view-switch {
    align-self: flex-end;
  }

  .list-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-head,
  .book-frame {
    animation-delay: 0ms !important;
  }
}
</style>
