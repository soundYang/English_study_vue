<script setup>
/**
 * 词汇工具行
 *
 * 用途：搜索框（防抖 300ms、回车立即查询、Esc 清空）、“批量导入”与“添加单词”按钮
 * 用法：<WordToolbar :value="store.query" @search="handleSearch" @add="openAddPanel"
 *                     @batch="batchOpen = true" />
 *
 * props:
 *   value — 当前生效的搜索词；由父级在“清除搜索”时回写
 * emits:
 *   search — 搜索词（已去首尾空格，可能为空字符串）
 *   add    — 点击“添加单词”
 *   batch  — 点击“批量导入”
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { FileUp, Plus, Search, X } from 'lucide-vue-next'
import BaseButton from '../../../component/BaseButton.vue'

const DEBOUNCE_DELAY = 300

const props = defineProps({
  value: { type: String, default: '' },
})

const emit = defineEmits(['search', 'add', 'batch'])

const keyword = ref(props.value)

let timer = null

watch(
  () => props.value,
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

function handleInput() {
  scheduleSearch()
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
  <div class="word-toolbar">
    <div class="search-box" :class="{ 'has-value': Boolean(keyword) }">
      <Search class="search-icon" :size="16" :stroke-width="1.8" aria-hidden="true" />
      <input
        v-model="keyword"
        class="search-input"
        type="search"
        placeholder="搜索单词或释义…"
        aria-label="搜索单词或释义"
        autocomplete="off"
        @input="handleInput"
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

    <div class="toolbar-actions">
      <BaseButton variant="secondary" class="batch-button" @click="emit('batch')">
        <FileUp :size="16" :stroke-width="2" aria-hidden="true" />
        批量导入
      </BaseButton>
      <BaseButton class="add-button" @click="emit('add')">
        <Plus :size="16" :stroke-width="2" aria-hidden="true" />
        添加单词
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.word-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 280px;
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

.search-input:hover {
  border-color: var(--color-line-strong);
}

.search-input:focus {
  border-color: var(--color-primary);
}

/* 使用自有清除按钮，隐藏浏览器原生叉号 */
.search-input::-webkit-search-cancel-button {
  display: none;
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

.toolbar-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

.add-button,
.batch-button {
  flex: 0 0 auto;
}

@media (max-width: 767px) {
  .search-box {
    flex: 1;
    width: auto;
  }

  .search-input {
    font-size: 16px;
  }

  .toolbar-actions {
    gap: var(--space-1);
  }

  .add-button,
  .batch-button {
    padding: 0 var(--space-3);
  }
}
</style>
