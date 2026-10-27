<script setup>
/**
 * 我的单词视图
 * 组合搜索、状态筛选、分页与增删改；右侧为常驻添加表单，小于 1200px 时改用弹层。
 * 所有请求状态由 words store 维护，本页只负责交互、Toast 与行高亮。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import BaseButton from '../../component/BaseButton.vue'
import BaseModal from '../../component/BaseModal.vue'
import ConfirmDialog from '../../component/ConfirmDialog.vue'
import EmptyState from '../../component/EmptyState.vue'
import PaginationBar from '../../component/PaginationBar.vue'
import WordEditModal from './component/WordEditModal.vue'
import WordFormPanel from './component/WordFormPanel.vue'
import WordStatusTabs from './component/WordStatusTabs.vue'
import WordTable from './component/WordTable.vue'
import WordToolbar from './component/WordToolbar.vue'
import wordsBook from '../../assets/images/words-book.png'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { useToast } from '../../composables/useToast'
import { useWordsStore } from '../../stores/model/words'

const TOAST_HIGHLIGHT_DURATION = 800
const EDIT_HIGHLIGHT_DURATION = 600

const toast = useToast()
const store = useWordsStore()
const isWide = useMediaQuery('(min-width: 1200px)')

const addModalOpen = ref(false)
const editOpen = ref(false)
const editingWord = ref(null)
const deleteOpen = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)
const highlightId = ref('')
const desktopPanel = ref(null)
const modalPanel = ref(null)

let highlightTimer = null

const statusModel = computed({
  get: () => store.status,
  set: (value) => {
    store.filterByStatus(value)
  },
})

const allWordsLabel = computed(() => {
  if (store.counts) return store.counts.all
  return store.loading ? '—' : store.total
})

const listTitle = computed(() => (store.query ? '搜索结果' : '词汇列表'))
const showEmpty = computed(() => !store.loading && !store.error && store.items.length === 0)
const emptyActionVariant = computed(() => (store.isFiltered ? 'ghost' : 'primary'))

const emptyMeta = computed(() => {
  if (store.query) {
    return {
      title: '没有找到匹配的单词',
      description: '换个关键词试试，或清除搜索。',
      actionText: '清除搜索',
      image: '',
    }
  }

  if (store.status !== 'all') {
    return {
      title: '这个状态下还没有单词',
      description: '切换其他状态，或查看全部单词。',
      actionText: '查看全部',
      image: '',
    }
  }

  return {
    title: '还没有单词',
    description: '先添加第一个单词，开始你的阅读训练。',
    actionText: '添加单词',
    image: wordsBook,
  }
})

const deleteTitle = computed(() =>
  deleteTarget.value ? `删除 “${deleteTarget.value.word}”？` : '删除这个单词？',
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
  store.search(value)
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
  store.search('')
}

function handleEmptyAction() {
  if (store.query) {
    clearSearch()
    return
  }
  if (store.status !== 'all') {
    store.filterByStatus('all')
    return
  }
  openAddPanel()
}

async function handleAdd(payload) {
  const result = await store.addWord(payload)

  if (!result.ok) {
    if (!Object.keys(result.errors || {}).length) toast.error(result.message)
    return result
  }

  toast.success(`已添加 ${result.item.word}`)
  flashRow(result.item.id, TOAST_HIGHLIGHT_DURATION)
  return { ok: true }
}

async function handleUpdate(id, patch) {
  const result = await store.updateWord(id, patch)

  if (!result.ok) {
    if (!Object.keys(result.errors || {}).length) toast.error(result.message)
    return result
  }

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

        <WordToolbar :value="store.query" @search="handleSearch" @add="openAddPanel" />

        <WordStatusTabs v-model="statusModel" :counts="store.counts" />

        <div v-if="!store.error" class="list-head">
          <h2 class="list-title">{{ listTitle }}</h2>
          <span v-if="store.query && !store.loading" class="list-count">
            找到 {{ store.total }} 个单词
          </span>
        </div>

        <WordTable
          v-if="store.loading || store.error || store.hasItems"
          :items="store.items"
          :loading="store.loading"
          :error="store.error"
          :highlight-id="highlightId"
          @edit="openEdit"
          @remove="askDelete"
          @retry="reload"
        />

        <EmptyState
          v-else-if="showEmpty"
          :title="emptyMeta.title"
          :description="emptyMeta.description"
          :image="emptyMeta.image"
          class="words-empty"
        >
          <template #actions>
            <BaseButton :variant="emptyActionVariant" @click="handleEmptyAction">
              {{ emptyMeta.actionText }}
            </BaseButton>
          </template>
        </EmptyState>

        <div v-if="!store.loading && !store.error && store.total > 0" class="list-footer">
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
