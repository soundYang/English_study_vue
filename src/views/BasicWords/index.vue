<script setup>
/**
 * 基础词库视图
 * 三张词表（基础词 / 日历词 / 缩写）的分页浏览，数字卡与分组标签读接口 counts。
 * 请求、筛选与分页状态都在 basic-words store，本页只负责交互、空态与提示。
 */
import { computed, onBeforeUnmount, onMounted } from 'vue'
import BaseButton from '../../component/BaseButton.vue'
import EmptyState from '../../component/EmptyState.vue'
import PaginationBar from '../../component/PaginationBar.vue'
import BasicStats from './component/BasicStats.vue'
import GroupTabs from './component/GroupTabs.vue'
import WordCardGrid from './component/WordCardGrid.vue'
import WordIndexToolbar from './component/WordIndexToolbar.vue'
import { useBasicWordsStore } from '../../stores/model/basic-words'

const store = useBasicWordsStore()

const groupModel = computed({
  get: () => store.group,
  set: (value) => store.setGroup(value),
})

const statusModel = computed({
  get: () => store.status,
  set: (value) => store.setStatus(value),
})

const pageSizeModel = computed({
  get: () => store.pageSize,
  set: (value) => store.setPageSize(value),
})

const pageCount = computed(() => Math.max(1, Math.ceil(store.total / store.pageSize)))
const showEmpty = computed(() => !store.loading && !store.error && store.total === 0)

const emptyMeta = computed(() => {
  if (store.query) {
    return {
      title: '没有找到匹配的单词',
      description: '换个关键词试试，或切换分组。',
      actionText: '清除搜索',
    }
  }

  if (store.status !== 'all') {
    return {
      title: '这个状态还没有单词',
      description: '切换其它状态，或查看全部。',
      actionText: '查看全部状态',
    }
  }

  return {
    title: '这个分组暂时没有单词',
    description: '换一个分组看看。',
    actionText: '看基础词',
  }
})

onMounted(() => store.fetchList())

// 离开页面就清空：下次进来从第 1 页、基础词、全部状态开始，不继承上次的筛选
onBeforeUnmount(() => store.reset())

function handleEmptyAction() {
  if (store.query) {
    store.search('')
    return
  }

  if (store.status !== 'all') {
    store.setStatus('all')
    return
  }

  store.setGroup('basic')
}
</script>

<template>
  <section class="basic-words-page">
    <header class="page-head">
      <h1 class="page-title">基础词汇库</h1>
      <p class="page-desc">积累每一个单词，拓宽你的阅读世界</p>
    </header>

    <BasicStats class="stats" :counts="store.counts" />

    <GroupTabs v-model="groupModel" class="tabs" :counts="store.counts" />

    <WordIndexToolbar
      class="toolbar"
      :query="store.query"
      :status="store.status"
      :page-size="store.pageSize"
      @search="store.search"
      @update:status="store.setStatus"
      @update:page-size="store.setPageSize"
    />

    <div class="list-area">
      <WordCardGrid
        v-if="store.loading || store.error || store.hasItems"
        :items="store.items"
        :loading="store.loading"
        :error="store.error"
        @retry="store.fetchList()"
      />

      <EmptyState
        v-else-if="showEmpty"
        :title="emptyMeta.title"
        :description="emptyMeta.description"
        class="words-empty"
      >
        <template #actions>
          <BaseButton variant="secondary" @click="handleEmptyAction">
            {{ emptyMeta.actionText }}
          </BaseButton>
        </template>
      </EmptyState>
    </div>

    <footer v-if="!store.loading && !store.error && store.total > 0" class="list-footer">
      <p class="total-text">
        共 {{ store.total }} 条
        <span class="page-progress">当前第 {{ store.page }} / {{ pageCount }} 页</span>
      </p>
      <PaginationBar
        :page="store.page"
        :total="store.total"
        :page-size="store.pageSize"
        @update:page="store.goToPage"
      />
    </footer>
  </section>
</template>

<style scoped>
.page-head {
  animation: basic-words-rise var(--dur-page) var(--ease-out) both;
}

.stats {
  margin-top: var(--space-6);
  animation: basic-words-rise var(--dur-page) var(--ease-out) 40ms both;
}

.tabs {
  margin-top: var(--space-6);
}

.toolbar,
.list-area {
  margin-top: var(--space-4);
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
  margin-top: var(--space-5);
}

.total-text {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.page-progress {
  margin-left: var(--space-2);
}

@keyframes basic-words-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1023px) {
  .stats {
    margin-top: var(--space-5);
  }
}

@media (max-width: 767px) {
  .tabs {
    margin-top: var(--space-5);
  }

  /* 窄屏分页条自己会显示「第 x / y 页」，这里不重复 */
  .page-progress {
    display: none;
  }

  .list-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-head,
  .stats {
    animation-delay: 0ms !important;
  }
}
</style>
