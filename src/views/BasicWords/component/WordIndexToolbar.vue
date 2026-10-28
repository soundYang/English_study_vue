<script setup>
/**
 * 基础词库工具栏
 *
 * 用途：搜索（词形 / 中文释义 / 缩写全称）+ 状态筛选 + 每页条数，固定在词表上方
 * 用法：<WordIndexToolbar :query="store.query" :status="store.status"
 *          :page-size="store.pageSize" @search="store.search"
 *          @update:status="store.setStatus" @update:page-size="store.setPageSize" />
 *
 * 交互沿用「我的单词」的搜索框：输入后 300ms 防抖、回车立即查询、Esc 清空。
 * 45 字符是后端的搜索词上限，超了会 400，所以直接在输入框拦住。
 *
 * props:
 *   query    — 当前生效的搜索词
 *   status   — 状态筛选值（all / unknown / known / removed）
 *   pageSize — 每页条数（100 / 50）
 *   disabled — 请求进行中时禁用筛选
 * emits:
 *   search / update:status / update:page-size
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { Search, X } from 'lucide-vue-next'
import DropdownSelect from '../../../component/DropdownSelect.vue'
import { BASIC_PAGE_SIZE_OPTIONS, BASIC_STATUS_OPTIONS } from '../../../unit/basic-words'

const DEBOUNCE_DELAY = 300
const MAX_QUERY_LENGTH = 45

const props = defineProps({
  query: { type: String, default: '' },
  status: { type: String, default: 'all' },
  pageSize: { type: Number, default: 100 },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['search', 'update:status', 'update:page-size'])

const keyword = ref(props.query)

let timer = null

watch(
  () => props.query,
  (value) => {
    keyword.value = value
  },
)

function cancelTimer() {
  if (!timer) return
  clearTimeout(timer)
  timer = null
}

function emitSearch(value) {
  cancelTimer()
  emit('search', String(value).trim())
}

function scheduleSearch() {
  cancelTimer()
  timer = setTimeout(() => {
    timer = null
    emit('search', keyword.value.trim())
  }, DEBOUNCE_DELAY)
}

function handleKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    emitSearch(keyword.value)
    return
  }

  if (event.key === 'Escape' && keyword.value) {
    event.preventDefault()
    keyword.value = ''
    emitSearch('')
  }
}

function clearKeyword() {
  keyword.value = ''
  emitSearch('')
}

onBeforeUnmount(cancelTimer)
</script>

<template>
  <div class="index-toolbar">
    <div class="search-box" :class="{ 'has-value': Boolean(keyword) }">
      <Search class="search-icon" :size="16" :stroke-width="1.8" aria-hidden="true" />
      <input
        v-model="keyword"
        class="search-input"
        type="search"
        :maxlength="MAX_QUERY_LENGTH"
        placeholder="搜索单词、中文释义或缩写全称…"
        aria-label="搜索单词、中文释义或缩写全称"
        autocomplete="off"
        :disabled="disabled"
        @input="scheduleSearch"
        @keydown="handleKeydown"
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

    <div class="filters">
      <DropdownSelect
        :model-value="status"
        :options="BASIC_STATUS_OPTIONS"
        aria-label="按标记状态筛选"
        :disabled="disabled"
        @update:model-value="emit('update:status', $event)"
      />

      <DropdownSelect
        :model-value="pageSize"
        :options="BASIC_PAGE_SIZE_OPTIONS"
        aria-label="每页条数"
        :disabled="disabled"
        align="end"
        @update:model-value="emit('update:page-size', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.index-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 420px;
}

.search-icon {
  position: absolute;
  left: var(--space-3);
  color: var(--color-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 40px;
  padding: 0 36px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 14px;
  line-height: 22px;
  transition:
    border-color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}

.search-input::placeholder {
  /* 占位符属于文字内容，需与正文同样满足 4.5:1 */
  color: var(--color-muted);
}

.search-input:hover:not(:disabled) {
  border-color: var(--color-line-strong);
}

.search-input:focus {
  border-color: var(--color-primary);
}

/* 使用自有清除按钮，隐藏浏览器原生叉号 */
.search-input::-webkit-search-cancel-button {
  display: none;
}

.search-input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.search-clear {
  position: absolute;
  right: var(--space-2);
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: var(--color-muted);
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.search-clear:hover {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.filters {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-left: auto;
}

@media (max-width: 767px) {
  .index-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: var(--space-2);
  }

  .search-box {
    flex: none;
    max-width: none;
  }

  .search-input {
    height: 44px;
    /* 16px 以下 iOS 会自动放大页面 */
    font-size: 16px;
  }

  .filters {
    margin-left: 0;
  }

  .filters > * {
    flex: 1;
  }
}
</style>
