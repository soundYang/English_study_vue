<script setup>
/**
 * 词库详情页
 *
 * 用途：浏览某个可选词库的目录，挑选并导入单词；在「已导入」Tab 里批量改学习状态或重置词库。
 * 用法：路由 /words/banks/:bank（high / mid）
 *
 * props（来自路由）:
 *   bank — 词库 key，只接受 high / mid；其它值由后端 404，页面显示错误卡
 *
 * 行为：
 *   · 未导入 Tab：搜索、分页、全选本页、导入所选、整库分批导入（单批 500）
 *   · 已导入 Tab：全选 / 单选、批量改状态；标为「已排除」后仍留在本 Tab
 *   · 重置二次确认写明「只移除从该词库导入的词」
 *   · 返回 / 重新进入同一词库时保留 Tab、页码与搜索词
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Library, RefreshCw, RotateCcw } from 'lucide-vue-next'
import BaseButton from '../../component/BaseButton.vue'
import ConfirmDialog from '../../component/ConfirmDialog.vue'
import EmptyState from '../../component/EmptyState.vue'
import PaginationBar from '../../component/PaginationBar.vue'
import BankToolbar from './component/BankToolbar.vue'
import BankWordTable from './component/BankWordTable.vue'
import { useAuthGate } from '../../composables/useAuthGate'
import { useToast } from '../../composables/useToast'
import { useWordBanksStore } from '../../stores/model/word-banks'

const BANK_LABELS = { high: '高频词库', mid: '中频词库' }
const STATUS_TARGETS = [
  { value: 'new', label: '新词' },
  { value: 'learning', label: '复习中' },
  { value: 'mastered', label: '已掌握' },
  { value: 'removed', label: '已排除' },
  { value: 'restore', label: '恢复' },
]
const TARGET_LABELS = Object.fromEntries(STATUS_TARGETS.map((item) => [item.value, item.label]))

const route = useRoute()
const router = useRouter()
const toast = useToast()
const store = useWordBanksStore()
const { requireAuth } = useAuthGate()

const bankKey = computed(() => String(route.params.bank || ''))
const selected = ref([])
const busy = ref(false)
const importAllOpen = ref(false)
const resetOpen = ref(false)
const statusTarget = ref('learning')
const batchOpen = ref(false)

const summary = computed(() => store.bankByKey.get(bankKey.value) || null)
const bankLabel = computed(
  () => summary.value?.label || store.bank?.label || BANK_LABELS[bankKey.value] || bankKey.value,
)
const loading = computed(() => store.listLoading && !store.hasLoaded)
const allSelected = computed(
  () => store.items.length > 0 && store.items.every((item) => selected.value.includes(item.word)),
)
const selectedSet = computed(() => new Set(selected.value))
const statusLabel = computed(() => TARGET_LABELS[statusTarget.value] || statusTarget.value)

watch(
  bankKey,
  (key) => {
    selected.value = []
    store.openBank(key)
  },
  { immediate: true },
)

onMounted(() => {
  store.fetchBanks({ quiet: true })
})

function goPage(value) {
  selected.value = []
  store.goToPage(value)
}

function setTab(value) {
  selected.value = []
  store.setTab(value)
}

function search(value) {
  selected.value = []
  store.search(value)
}

function toggleWord(item) {
  const word = item.word
  selected.value = selectedSet.value.has(word)
    ? selected.value.filter((value) => value !== word)
    : [...selected.value, word]
}

function togglePage() {
  const words = store.items.map((item) => item.word)

  selected.value = allSelected.value
    ? selected.value.filter((word) => !words.includes(word))
    : [...new Set([...selected.value, ...words])]
}

function skippedMessage(skipped = []) {
  if (!skipped.length) return ''
  const basic = skipped.filter((item) => item.reason === 'BASIC_WORD_EXCLUDED').length
  const missing = skipped.filter((item) => item.reason === 'NOT_IN_BANK').length
  const invalid = skipped.filter((item) => item.reason === 'INVALID_WORD').length
  const parts = []
  if (basic) parts.push(`${basic} 个属于基础词表`)
  if (missing) parts.push(`${missing} 个不在该词库`)
  if (invalid) parts.push(`${invalid} 个词形不合法`)
  return parts.length ? `；跳过 ${parts.join('，')}` : ''
}

async function importSelected() {
  if (!requireAuth(() => {})) return
  if (!selected.value.length) {
    toast.info('先选择要导入的单词')
    return
  }

  busy.value = true
  const result = await store.importWords(selected.value)
  busy.value = false

  if (!result.ok) {
    toast.error(result.message || '导入失败，请稍后再试')
    return
  }

  selected.value = []
  toast.success(
    `导入完成：新建 ${result.created} 个，已在词库 ${result.existing} 个` +
      skippedMessage(result.skipped),
  )
  if (result.remainingSlots === 0) toast.info('个人词库名额已用完，清理一些词后再继续导入')
}

function askImportAll() {
  if (!requireAuth(() => {})) return
  importAllOpen.value = true
}

async function confirmImportAll() {
  importAllOpen.value = false
  busy.value = true
  const result = await store.importAll()
  busy.value = false

  if (!result.ok) {
    toast.error(result.message || '整库导入中断，请稍后从中断处继续')
    return
  }

  const data = result.data
  if (data.limitReached) {
    toast.info(`个人词库名额不足：已新建 ${data.created} 个，还有词没导入。腾出名额后可再次导入。`)
  } else {
    toast.success(`整库导入完成：新建 ${data.created} 个，已在词库 ${data.existing} 个`)
  }
}

function askBatch() {
  if (!requireAuth(() => {})) return
  if (!selected.value.length) {
    toast.info('先选择要修改的词')
    return
  }
  batchOpen.value = true
}

async function confirmBatch() {
  batchOpen.value = false
  busy.value = true
  const result = await store.batchStatus(selected.value, statusTarget.value)
  busy.value = false

  if (!result.ok) {
    toast.error(result.message || '修改失败，请稍后再试')
    return
  }

  const skipped = result.notInBank?.length || 0
  toast.success(
    `已更新 ${result.updated} 个词` +
      (result.unchanged ? `，${result.unchanged} 个未变化` : '') +
      (skipped ? `；${skipped} 个不在本词库导入记录里，已跳过` : ''),
  )
  selected.value = []
}

async function confirmReset() {
  resetOpen.value = false
  busy.value = true
  const result = await store.resetBank(bankKey.value)
  busy.value = false

  if (!result.ok) {
    toast.error(result.message || '重置失败，请稍后再试')
    return
  }

  selected.value = []
  toast.success(
    `已重置${bankLabel.value}：移除 ${result.removedWords} 个词，保留 ${result.keptWords} 个`,
  )
  // 重置后「未导入」Tab 仍是当前视图；若停在已导入 Tab 且已空，切回未导入
  if (store.tab === 'imported') setTab('not_imported')
}
</script>

<template>
  <div class="bank-detail-page">
    <header class="detail-head">
      <nav class="breadcrumb" aria-label="面包屑">
        <RouterLink to="/words/banks" class="crumb-link">词库</RouterLink>
        <span class="crumb-sep" aria-hidden="true">/</span>
        <span class="crumb-current">{{ bankLabel }}</span>
      </nav>

      <div class="title-row">
        <div class="title-copy">
          <h1 class="bank-title">
            <Library :size="22" :stroke-width="1.6" aria-hidden="true" />
            {{ bankLabel }}
          </h1>
          <p class="bank-desc">
            从目录挑选单词导入个人词库。导入后可在「已导入」里批量调整学习状态。
          </p>
        </div>

        <div class="head-actions">
          <BaseButton variant="ghost" size="sm" @click="router.push({ name: 'words-banks' })">
            <ArrowLeft :size="15" :stroke-width="1.8" aria-hidden="true" />
            返回词库
          </BaseButton>
          <BaseButton
            v-if="summary?.imported"
            class="reset-bank"
            variant="ghost"
            size="sm"
            :disabled="busy"
            @click="resetOpen = true"
          >
            <RotateCcw :size="15" :stroke-width="1.8" aria-hidden="true" />
            重置词库
          </BaseButton>
        </div>
      </div>

      <dl v-if="summary" class="summary-strip">
        <div>
          <dt>目录总量</dt>
          <dd>{{ summary.total }}</dd>
        </div>
        <div>
          <dt>已导入</dt>
          <dd>{{ summary.imported }}</dd>
        </div>
        <div>
          <dt>剩余名额</dt>
          <dd>{{ summary.remainingSlots }}</dd>
        </div>
      </dl>
    </header>

    <BankToolbar
      :tab="store.tab"
      :imported-count="store.importedCount"
      :not-imported-count="store.notImportedCount"
      :query="store.query"
      :selected-count="selected.length"
      :all-selected="allSelected"
      :progress="store.importProgress"
      :busy="busy || store.importProgress?.running === true"
      @update:tab="setTab"
      @search="search"
      @toggle-all="togglePage"
      @import-selected="importSelected"
      @import-all="askImportAll"
    />

    <div v-if="store.tab === 'imported'" class="batch-panel">
      <span class="batch-copy">
        {{ selected.length ? `已选 ${selected.length} 个词` : '选择词后可批量修改学习状态' }}
      </span>
      <select v-model="statusTarget" class="batch-target" aria-label="批量修改为">
        <option v-for="option in STATUS_TARGETS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <BaseButton variant="secondary" size="sm" :disabled="busy" @click="askBatch">
        应用
      </BaseButton>
    </div>

    <div v-if="loading" class="bank-loading" aria-hidden="true">
      <div v-for="index in 6" :key="index" class="loading-row">
        <span class="skeleton-line"></span>
        <span class="skeleton-line is-short"></span>
      </div>
    </div>

    <EmptyState
      v-else-if="store.listError"
      class="bank-empty"
      title="词库目录加载失败"
      :description="store.listError"
    >
      <template #actions>
        <BaseButton variant="secondary" @click="store.fetchList()">
          <RefreshCw :size="15" :stroke-width="1.8" aria-hidden="true" />
          重试
        </BaseButton>
      </template>
    </EmptyState>

    <EmptyState
      v-else-if="!store.items.length"
      class="bank-empty"
      :title="
        store.tab === 'imported'
          ? '还没有从这个词库导入的词'
          : store.query
            ? '没有找到匹配的单词'
            : '这个词库已经没有未导入的词'
      "
      :description="
        store.tab === 'imported'
          ? '去「未导入」挑一些词，导入后会出现在这里。'
          : store.query
            ? '换个关键词，或清空搜索后再试。'
            : '可以切换到「已导入」查看已经收录的词。'
      "
    />

    <BankWordTable
      v-else
      :items="store.items"
      :tab="store.tab"
      :selected="selected"
      @toggle="toggleWord"
    />

    <footer v-if="store.items.length" class="list-footer">
      <span class="footer-count">共 {{ store.total }} 个词</span>
      <PaginationBar
        :page="store.page"
        :total="store.total"
        :page-size="store.pageSize"
        @update:page="goPage"
      />
    </footer>

    <ConfirmDialog
      :open="importAllOpen"
      :title="`导入全部${bankLabel}？`"
      description="整库导入会按每批 500 个分批写入个人词库。个人词库名额不足时会自动停下，已导入的部分保留。"
      confirm-text="开始导入"
      :loading="busy"
      @update:open="(open) => !open && (importAllOpen = false)"
      @confirm="confirmImportAll"
    />

    <ConfirmDialog
      :open="batchOpen"
      :title="`把选中的 ${selected.length} 个词标为「${statusLabel}」？`"
      :description="
        statusTarget === 'removed'
          ? '这些词会从阅读生成中排除，但不会从本词库删除；之后可再恢复。'
          : '学习状态会影响阅读生成与复习计划。'
      "
      :confirm-text="`标为${statusLabel}`"
      :danger="statusTarget === 'removed'"
      :loading="busy"
      @update:open="(open) => !open && (batchOpen = false)"
      @confirm="confirmBatch"
    />

    <ConfirmDialog
      :open="resetOpen"
      :title="`重置${bankLabel}？`"
      description="只移除从该词库导入的词，你自己原有的词不受影响。此操作不可撤销。"
      confirm-text="重置词库"
      danger
      :loading="busy"
      @update:open="(open) => !open && (resetOpen = false)"
      @confirm="confirmReset"
    />
  </div>
</template>

<style scoped>
.bank-detail-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 1040px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-5) var(--space-8);
}

.detail-head {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.crumb-link {
  color: var(--color-muted);
  text-decoration: none;
}

.crumb-link:hover {
  color: var(--color-ink);
}

.crumb-sep {
  opacity: 0.6;
}

.crumb-current {
  color: var(--color-ink);
}

.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.title-copy {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.bank-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: var(--text-page-title);
  font-weight: 500;
  line-height: var(--leading-page-title);
}

.bank-desc {
  max-width: 62ch;
  margin: 0;
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.head-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.head-actions :deep(button) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.summary-strip {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.summary-strip div {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.summary-strip dt {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.summary-strip dd {
  margin: 0;
  color: var(--color-ink);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  font-variant-numeric: tabular-nums;
}

.batch-panel {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px dashed var(--color-line-strong);
  border-radius: var(--radius-md);
  background: var(--color-bg-deep);
  flex-wrap: wrap;
}

.batch-copy {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.batch-target {
  margin-left: auto;
  padding: 6px 10px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: var(--text-small);
}

.bank-loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.loading-row {
  display: flex;
  gap: var(--space-4);
}

.skeleton-line {
  display: block;
  flex: 1;
  height: 14px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--color-bg-deep) 0%,
    var(--color-line) 50%,
    var(--color-bg-deep) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-sweep 1.4s ease-in-out infinite;
}

.skeleton-line.is-short {
  flex: 0 0 34%;
}

@keyframes skeleton-sweep {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

.bank-empty {
  padding: var(--space-8) 0;
}

.list-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.footer-count {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

@media (max-width: 767px) {
  .bank-detail-page {
    padding: var(--space-4) var(--space-4) var(--space-8);
  }

  .head-actions {
    width: 100%;
  }

  .summary-strip {
    gap: var(--space-4);
    flex-wrap: wrap;
  }
}
</style>
