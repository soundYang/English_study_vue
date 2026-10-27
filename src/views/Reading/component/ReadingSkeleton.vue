<script setup>
/**
 * 答题页骨架
 * 用途：文章标题 + 3 组段落 + 2 张题目卡的加载占位，与真实双栏布局对齐
 * 用法：<ReadingSkeleton />
 */
import SkeletonBlock from '../../../component/SkeletonBlock.vue'
</script>

<template>
  <div class="reading-skeleton" aria-busy="true" aria-label="正在加载练习">
    <div class="skeleton-article">
      <SkeletonBlock width="46%" height="32px" radius="var(--radius-sm)" />
      <SkeletonBlock width="24%" height="13px" />

      <div v-for="paragraph in 3" :key="paragraph" class="skeleton-paragraph">
        <SkeletonBlock width="100%" height="14px" />
        <SkeletonBlock width="96%" height="14px" />
        <SkeletonBlock width="98%" height="14px" />
        <SkeletonBlock width="62%" height="14px" />
      </div>
    </div>

    <div class="skeleton-questions">
      <SkeletonBlock width="52%" height="22px" />

      <div v-for="card in 2" :key="card" class="skeleton-question">
        <SkeletonBlock width="78%" height="16px" />
        <SkeletonBlock width="46%" height="13px" />
        <div class="skeleton-options">
          <SkeletonBlock v-for="option in 4" :key="option" width="100%" height="36px" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reading-skeleton {
  display: grid;
  grid-template-columns: minmax(0, 58fr) minmax(0, 42fr);
  align-items: start;
  gap: 28px;
}

.skeleton-article {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-10);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

.skeleton-paragraph {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.skeleton-questions {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-top: var(--space-2);
}

.skeleton-question {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-5);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.skeleton-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

@media (max-width: 1023px) {
  .reading-skeleton {
    grid-template-columns: minmax(0, 1fr);
  }

  .skeleton-questions {
    padding-top: var(--space-2);
  }
}

@media (max-width: 767px) {
  .skeleton-article {
    padding: var(--space-5);
  }

  .skeleton-questions {
    display: none;
  }
}
</style>
