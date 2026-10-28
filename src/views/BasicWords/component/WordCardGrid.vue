<script setup>
/**
 * 基础词卡片网格
 *
 * 用途：词表的网格视图，含加载骨架与错误卡；空态由页面用 EmptyState 承担
 * 用法：<WordCardGrid :items="items" :loading="loading" :error="error" :pending-word="pendingWord"
 *         @retry="reload" @remove="onRemove" @restore="onRestore" />
 *
 * 列数按视口固定：桌面 4 列，1440 起 5 列，1800 起 6 列。不用 auto-fill——
 * 设计要求是「4–5 列、宽屏 5–6 列」，自动流会让 1200px 自己滑成 5 列。
 *
 * props:
 *   items       — 词表项数组
 *   loading     — 加载中，显示 12 张骨架卡
 *   error       — 错误文案，存在时整块替换为错误卡
 *   pendingWord — 写请求进行中的词，只禁用对应那一个菜单
 * emits:
 *   retry — 错误卡中的重试
 *   remove / restore — 逐张卡片转发上去
 */
import BaseButton from '../../../component/BaseButton.vue'
import SkeletonBlock from '../../../component/SkeletonBlock.vue'
import WordCard from './WordCard.vue'

defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  pendingWord: { type: String, default: '' },
})

const emit = defineEmits(['retry', 'remove', 'restore'])
</script>

<template>
  <div v-if="error" class="state-card" role="alert">
    <p class="state-title">词表加载失败</p>
    <p class="state-desc">{{ error }}</p>
    <BaseButton variant="secondary" @click="emit('retry')">重试</BaseButton>
  </div>

  <ul v-else-if="loading" class="word-grid is-skeleton" aria-hidden="true">
    <li v-for="row in 12" :key="`skeleton-${row}`" class="skeleton-card">
      <SkeletonBlock width="58%" height="20px" />
      <SkeletonBlock width="42%" height="13px" />
      <SkeletonBlock width="76%" height="13px" />
      <SkeletonBlock width="64px" height="22px" radius="var(--radius-pill)" />
    </li>
  </ul>

  <ul v-else class="word-grid">
    <li v-for="item in items" :key="item.word" class="grid-item">
      <WordCard
        :item="item"
        :pending="item.word === pendingWord"
        @remove="emit('remove', $event)"
        @restore="emit('restore', $event)"
      />
    </li>
  </ul>
</template>

<style scoped>
.word-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.grid-item {
  display: flex;
  min-width: 0;
}

.grid-item > * {
  flex: 1;
}

.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 142px;
  padding: var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

@media (min-width: 1440px) {
  .word-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (min-width: 1800px) {
  .word-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (max-width: 1099px) {
  .word-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .word-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }
}

@media (max-width: 479px) {
  .word-grid {
    grid-template-columns: minmax(0, 1fr);
  }
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
}
</style>
