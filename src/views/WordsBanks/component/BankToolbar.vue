<script setup>
/**
 * 词库详情工具栏
 *
 * 用途：切换「未导入 / 已导入」、搜索目录、全选本页、导入所选 / 整库导入，并展示分批进度。
 * 用法：<BankToolbar
 *         :tab="tab" :imported-count="12" :not-imported-count="2040"
 *         :query="query" :selected-count="3" :all-selected="false"
 *         :progress="progress"
 *         @update:tab="setTab" @search="search" @toggle-all="togglePage"
 *         @import-selected="importSelected" @import-all="askImportAll"
 *       />
 *
 * props:
 *   tab / importedCount / notImportedCount — 当前 Tab 与两个 Tab 的数字
 *   query        — 当前搜索词
 *   selectedCount / allSelected — 选择状态
 *   progress     — 整库导入进度（null 表示从未导入）
 *   busy         — 导入 / 批处理进行中，禁用操作
 * emits:
 *   update:tab / search / toggle-all / import-selected / import-all
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Search, X } from 'lucide-vue-next'
import BaseButton from '../../../component/BaseButton.vue'

const props = defineProps({
  tab: { type: String, default: 'not_imported' },
  importedCount: { type: Number, default: 0 },
  notImportedCount: { type: Number, default: 0 },
  query: { type: String, default: '' },
  selectedCount: { type: Number, default: 0 },
  allSelected: { type: Boolean, default: false },
  progress: { type: Object, default: null },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['update:tab', 'search', 'toggle-all', 'import-selected', 'import-all'])

const keyword = ref(props.query)
const SEARCH_DEBOUNCE = 300
let timer = 0

watch(
  () => props.query,
  (value) => {
    keyword.value = value
  },
)

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

function submit(value) {
  if (timer) {
    clearTimeout(timer)
    timer = 0
  }
  emit('search', String(value ?? ''))
}

function handleInput(event) {
  const { value } = event.target
  keyword.value = value
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => submit(value), SEARCH_DEBOUNCE)
}

function handleEnter() {
  submit(keyword.value)
}

function clearKeyword() {
  keyword.value = ''
  submit('')
}

const percent = computed(() => {
  const progress = props.progress
  if (!progress?.total) return 0
  return Math.min(100, Math.round((progress.done / progress.total) * 100))
})

const progressText = computed(() => {
  const progress = props.progress
  if (!progress) return ''

  if (progress.running) {
    return `正在导入 ${progress.done} / ${progress.total}，新建 ${progress.created} 个`
  }
  if (progress.limitReached) {
    return `名额不足，已导入 ${progress.created} 个；腾出名额后可再次导入剩余词`
  }
  return `整库导入完成：新建 ${progress.created} 个，已在词库 ${progress.existing} 个`
})
</script>

<template>
  <div class="bank-toolbar">
    <div class="toolbar-row">
      <div class="bank-tabs" role="tablist" aria-label="词库筛选">
        <button
          type="button"
          role="tab"
          class="bank-tab"
          :class="{ 'is-active': tab === 'not_imported' }"
          :aria-selected="tab === 'not_imported'"
          @click="emit('update:tab', 'not_imported')"
        >
          未导入
          <span class="tab-count">{{ notImportedCount }}</span>
        </button>
        <button
          type="button"
          role="tab"
          class="bank-tab"
          :class="{ 'is-active': tab === 'imported' }"
          :aria-selected="tab === 'imported'"
          @click="emit('update:tab', 'imported')"
        >
          已导入
          <span class="tab-count">{{ importedCount }}</span>
        </button>
      </div>

      <div class="bank-search">
        <Search :size="15" :stroke-width="1.8" class="search-icon" aria-hidden="true" />
        <input
          type="search"
          class="search-input"
          :value="keyword"
          placeholder="搜索单词或释义"
          aria-label="搜索词库"
          @input="handleInput"
          @keydown.enter.prevent="handleEnter"
        />
        <button
          v-if="keyword"
          type="button"
          class="search-clear"
          aria-label="清除搜索"
          @click="clearKeyword"
        >
          <X :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div class="toolbar-actions">
      <label class="select-all">
        <input
          type="checkbox"
          :checked="allSelected"
          :disabled="busy"
          @change="emit('toggle-all')"
        />
        全选本页
      </label>

      <span v-if="selectedCount" class="selected-count">已选 {{ selectedCount }} 个</span>

      <div v-if="tab === 'not_imported'" class="action-buttons">
        <BaseButton
          variant="secondary"
          size="sm"
          :disabled="busy || selectedCount === 0"
          @click="emit('import-selected')"
        >
          导入所选{{ selectedCount ? ` (${selectedCount})` : '' }}
        </BaseButton>
        <BaseButton variant="primary" size="sm" :disabled="busy" @click="emit('import-all')">
          导入全部
        </BaseButton>
      </div>
    </div>

    <div v-if="progress" class="import-progress" role="status" aria-live="polite">
      <div class="progress-track" aria-hidden="true">
        <span
          class="progress-fill"
          :class="{ 'is-limited': progress.limitReached }"
          :style="{ width: `${percent}%` }"
        ></span>
      </div>
      <p class="progress-text">{{ progressText }}</p>
    </div>
  </div>
</template>

<style scoped>
.bank-toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.bank-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border-radius: var(--radius-md);
  background: var(--color-bg-deep);
}

.bank-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.bank-tab:hover {
  color: var(--color-ink);
}

.bank-tab.is-active {
  background: var(--color-surface);
  color: var(--color-ink);
  box-shadow: var(--shadow-sm);
}

.tab-count {
  color: var(--color-muted);
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
}

.bank-search {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1 1 220px;
  min-width: 180px;
  padding: 0 10px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  transition: border-color var(--dur-fast) var(--ease-out);
}

.bank-search:focus-within {
  border-color: var(--color-primary-ink);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.search-icon {
  color: var(--color-muted);
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  padding: 8px 0;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.search-input:focus {
  outline: none;
}

.search-clear {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  color: var(--color-muted);
}

.search-clear:hover {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.select-all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  cursor: pointer;
}

.selected-count {
  color: var(--color-primary-ink);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

.import-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: var(--space-3);
  border-top: 1px dashed var(--color-line);
}

.progress-track {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-bg-deep);
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary-ink);
  transition: width var(--dur-fast) var(--ease-out);
}

.progress-fill.is-limited {
  background: var(--color-warning, #b7791f);
}

.progress-text {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

@media (max-width: 767px) {
  .bank-toolbar {
    padding: var(--space-3) var(--space-4);
  }

  .action-buttons {
    width: 100%;
    margin-left: 0;
  }

  .action-buttons :deep(button) {
    flex: 1;
  }
}
</style>
