<script setup>
/**
 * 我的单词视图
 * 组合搜索、状态筛选、分页与增删改；右侧为常驻添加表单，小于 1200px 时改用弹层。
 * 所有请求状态由 words store 维护，本页只负责交互、Toast 与行高亮。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../../component/BaseButton.vue'
import BaseModal from '../../component/BaseModal.vue'
import ConfirmDialog from '../../component/ConfirmDialog.vue'
import EmptyState from '../../component/EmptyState.vue'
import PaginationBar from '../../component/PaginationBar.vue'
import StatusPill from '../../component/StatusPill.vue'
import WordDetailPopover from '../../component/WordDetailPopover.vue'
import WordBatchImport from './component/WordBatchImport.vue'
import WordEditModal from './component/WordEditModal.vue'
import WordFormPanel from './component/WordFormPanel.vue'
import WordStatusTabs from './component/WordStatusTabs.vue'
import WordTable from './component/WordTable.vue'
import WordToolbar from './component/WordToolbar.vue'
import wordsBook from '../../assets/images/words-book.png'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { useToast } from '../../composables/useToast'
import { useWordsStore } from '../../stores/model/words'
import { myWordDetail } from '../../unit/word-detail'

const TOAST_HIGHLIGHT_DURATION = 800
const EDIT_HIGHLIGHT_DURATION = 600

const toast = useToast()
const store = useWordsStore()
const router = useRouter()
const isWide = useMediaQuery('(min-width: 1200px)')

const addModalOpen = ref(false)
const batchOpen = ref(false)
const editOpen = ref(false)
const editingWord = ref(null)
const deleteOpen = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)
const highlightId = ref('')
const desktopPanel = ref(null)
const modalPanel = ref(null)
// 详情浮层：{ item, anchor }，为空即关闭；数据来自列表快照，不额外请求
const detailTarget = ref(null)

const detailData = computed(() =>
  detailTarget.value ? myWordDetail(detailTarget.value.item) : null,
)

let highlightTimer = null

const statusModel = computed({
  get: () => store.status,
  set: (value) => {
    rememberEmptyView()
    store.filterByStatus(value)
  },
})

const allWordsLabel = computed(() => {
  if (store.counts) return store.counts.all
  return store.loading ? '—' : store.total
})

const listTitle = computed(() => (store.query ? '搜索结果' : '词汇列表'))
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

  if (store.status !== 'all') {
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
    description: '先添加第一个单词，开始你的阅读训练。',
    actionText: '添加单词',
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

// 换筛选 / 翻页后原来的锚点可能已经不在列表里，浮层跟着关掉
watch(
  () => [store.query, store.status, store.page],
  () => {
    detailTarget.value = null
  },
)

onMounted(() => {
  store.fetchList()
})

// useMediaQuery 在挂载后才有值，这里只在用户打开添加面板时读取最新结果
function shouldUseModal() {
  return !isWide.value
}

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
  rememberEmptyView()
  store.search(value)
}

function handleDetail({ item, anchor }) {
  if (detailTarget.value?.item.id === item.id) {
    detailTarget.value = null
    return
  }

  detailTarget.value = { item, anchor }
}

function handleDetailOpen(value) {
  if (!value) detailTarget.value = null
}

async function openAddPanel() {
  if (!shouldUseModal()) {
    desktopPanel.value?.focusWord()
    return
  }

  addModalOpen.value = true
  await nextTick()
  modalPanel.value?.focusWord()
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
    rememberEmptyView()
    store.filterByStatus('all')
    return
  }
  openAddPanel()
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

  detailTarget.value = null
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
  detailTarget.value = null

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

  detailTarget.value = null
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
  detailTarget.value = null

  if (result.ok) {
    toast.success(`已删除 ${result.item.word || target.word}`)
  } else {
    toast.error(result.message)
  }

  deleteTarget.value = null
}

function reload() {
  store.fetchList()
}
</script>

<template>
  <section class="words-page">
    <header class="page-head">
      <p class="page-eyebrow">Vocabulary</p>
      <h1 class="page-title">我的单词</h1>
      <p class="page-desc">
        你已累计 <strong class="count-accent">{{ allWordsLabel }}</strong> 个单词
      </p>
    </header>

    <div class="words-layout">
      <div class="words-main" :aria-busy="store.loading ? 'true' : 'false'">
        <span v-if="store.loading" class="sr-only" role="status">正在加载生词本</span>

        <WordToolbar
          :value="store.query"
          @search="handleSearch"
          @add="openAddPanel"
          @batch="batchOpen = true"
        />

        <WordStatusTabs v-model="statusModel" :counts="store.counts" />

        <div v-if="!store.error" class="list-head">
          <h2 class="list-title">{{ listTitle }}</h2>
          <!-- 切换筛选 / 搜索时列表继续显示旧数据，计数也先留在原位，等新结果一起换 -->
          <span v-if="store.query" class="list-count">找到 {{ store.total }} 个单词</span>
        </div>

        <!-- 首次加载（还没有成功结果）才挂列表骨架；有数据时挂着等新结果；
             列表为空且已加载过时交给下面的空态，加载中也不换成骨架 -->
        <WordTable
          v-if="store.error || store.hasItems || !store.hasLoaded"
          :items="store.items"
          :error="store.error"
          :highlight-id="highlightId"
          :expanded-word="detailTarget?.item.word || ''"
          @edit="openEdit"
          @remove="askDelete"
          @retry="reload"
          @detail="handleDetail"
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

        <!-- 加载中保留底栏：否则每切一次状态，底部分页都会消失再出现，页面高度抖一下 -->
        <div v-if="!store.error && store.total > 0" class="list-footer">
          <p class="total-text">共 {{ store.total }} 条</p>
          <PaginationBar
            :page="store.page"
            :total="store.total"
            :page-size="store.pageSize"
            @update:page="store.goToPage"
          />
        </div>
      </div>

      <aside class="words-aside">
        <WordFormPanel ref="desktopPanel" :submit-word="handleAdd" />
      </aside>
    </div>

    <BaseModal v-model:open="addModalOpen" title="添加单词" :max-width="520" sheet-on-mobile>
      <WordFormPanel v-if="addModalOpen" ref="modalPanel" compact :submit-word="handleAdd" />
    </BaseModal>

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

    <WordDetailPopover
      :open="Boolean(detailTarget)"
      :anchor="detailTarget?.anchor || null"
      :word="detailData?.word || ''"
      :phonetic="detailData?.phonetic || null"
      :senses="detailData?.senses || []"
      :facts="detailData?.facts || []"
      @update:open="handleDetailOpen"
    >
      <template #badges>
        <StatusPill v-if="detailTarget" kind="status" :value="detailTarget.item.status" />
      </template>
    </WordDetailPopover>
  </section>
</template>

<style scoped>
.page-head {
  animation: words-rise var(--dur-page) var(--ease-out) both;
}

.count-accent {
  color: var(--color-accent);
  font-family: var(--font-display);
  font-weight: 500;
}

.words-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: start;
  gap: 28px;
  margin-top: var(--space-6);
}

.words-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
  animation: words-rise var(--dur-page) var(--ease-out) 60ms both;
}

.words-aside {
  position: sticky;
  top: var(--space-6);
  animation: words-rise var(--dur-page) var(--ease-out) 120ms both;
}

.list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-1);
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

.total-text {
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

@media (max-width: 1279px) {
  .words-layout {
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: var(--space-5);
  }
}

@media (max-width: 1199px) {
  .words-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .words-aside {
    display: none;
  }
}

@media (max-width: 767px) {
  .words-layout {
    margin-top: var(--space-5);
  }

  .words-main {
    gap: var(--space-3);
  }

  .list-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-head,
  .words-main,
  .words-aside {
    animation-delay: 0ms !important;
  }
}
</style>
