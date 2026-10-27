<script setup>
/**
 * 分页条
 *
 * 用途：上一页 / 下一页 + 页码；移动端隐藏页码，显示“第 x / y 页”
 * 用法：<PaginationBar v-model:page="page" :total="total" :page-size="10" />
 *
 * props:
 *   page     — 当前页（v-model:page）
 *   total    — 总条数
 *   pageSize — 每页条数，默认 10
 * emits:
 *   update:page
 */
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps({
  page: { type: Number, required: true },
  total: { type: Number, default: 0 },
  pageSize: { type: Number, default: 10 },
})

const emit = defineEmits(['update:page'])

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

const pageItems = computed(() => {
  const count = totalPages.value
  const current = props.page

  if (count <= 7) {
    return Array.from({ length: count }, (_, index) => index + 1)
  }

  const items = [1]
  const start = Math.max(2, current - 2)
  const end = Math.min(count - 1, current + 2)

  if (start > 2) items.push('start-ellipsis')
  for (let index = start; index <= end; index += 1) items.push(index)
  if (end < count - 1) items.push('end-ellipsis')
  items.push(count)

  return items
})

function goTo(page) {
  if (page < 1 || page > totalPages.value || page === props.page) return
  emit('update:page', page)
}
</script>

<template>
  <nav class="pagination" aria-label="分页导航">
    <button
      type="button"
      class="page-button is-arrow"
      aria-label="上一页"
      :disabled="page <= 1"
      @click="goTo(page - 1)"
    >
      <ChevronLeft :size="16" :stroke-width="1.8" aria-hidden="true" />
    </button>

    <div class="page-numbers">
      <template v-for="item in pageItems" :key="item">
        <span v-if="typeof item === 'string'" class="page-ellipsis" aria-hidden="true">…</span>
        <button
          v-else
          type="button"
          class="page-button"
          :class="{ 'is-current': item === page }"
          :aria-current="item === page ? 'page' : undefined"
          :aria-label="`第 ${item} 页`"
          @click="goTo(item)"
        >
          {{ item }}
        </button>
      </template>
    </div>

    <span class="pagination-summary">第 {{ page }} / {{ totalPages }} 页</span>

    <button
      type="button"
      class="page-button is-arrow"
      aria-label="下一页"
      :disabled="page >= totalPages"
      @click="goTo(page + 1)"
    >
      <ChevronRight :size="16" :stroke-width="1.8" aria-hidden="true" />
    </button>
  </nav>
</template>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.page-button {
  display: grid;
  place-items: center;
  min-width: 32px;
  height: 32px;
  padding: 0 var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: 1;
  transition:
    background-color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.page-button:hover:not(:disabled):not(.is-current) {
  border-color: var(--color-line);
  background: var(--color-surface);
  color: var(--color-ink);
}

.page-button.is-current {
  background: var(--color-primary);
  color: var(--color-primary-ink);
}

.page-button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.page-ellipsis {
  min-width: 24px;
  color: var(--color-muted-2);
  text-align: center;
}

.pagination-summary {
  display: none;
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

@media (max-width: 767px) {
  .page-numbers {
    display: none;
  }

  .pagination-summary {
    display: inline;
  }
}
</style>
