<script setup>
/**
 * 阅读文章卡
 *
 * 用途：以衬线正文展示英文文章，按空行拆段，仅使用文本插值
 * 用法：<ArticleCard :title="reading.title" :article="reading.article" />
 *
 * props:
 *   title     — 文章标题
 *   article   — 英文正文（不含答案与翻译）
 *   wordCount — 后端 actualWords（真实词数）；为 0 时不渲染，兼容没有该字段的老数据
 *   titleTag  — 标题标签，默认 h1；结果页已有页面级 h1 时传 h2
 */
import { computed } from 'vue'
import { formatWordCount } from '../../../unit/format'

const props = defineProps({
  title: { type: String, default: '' },
  article: { type: String, default: '' },
  wordCount: { type: Number, default: 0 },
  titleTag: {
    type: String,
    default: 'h1',
    validator: (value) => ['h1', 'h2'].includes(value),
  },
})

const paragraphs = computed(() =>
  String(props.article)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean),
)
</script>

<template>
  <article class="article-card">
    <header class="article-head">
      <component :is="titleTag" class="article-title">{{ title }}</component>
      <p v-if="wordCount > 0" class="article-meta">{{ formatWordCount(wordCount) }}</p>
    </header>
    <div class="article-body">
      <p v-for="(paragraph, index) in paragraphs" :key="index" class="article-paragraph">
        {{ paragraph }}
      </p>
    </div>
  </article>
</template>

<style scoped>
.article-card {
  padding: var(--space-10);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

/* 标题与词数成组，间距挂在整组上，正文不再自带 margin-top */
.article-head {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}

.article-title {
  max-width: 34ch;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 400;
  line-height: 42px;
  letter-spacing: 0.01em;
}

.article-meta {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.article-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 68ch;
}

.article-paragraph {
  color: var(--color-ink-2);
  font-family: var(--font-reading);
  font-size: var(--text-reading);
  line-height: var(--leading-reading);
  text-align: left;
  overflow-wrap: anywhere;
}

@media (max-width: 767px) {
  .article-card {
    padding: var(--space-5);
    border-radius: var(--radius-lg);
  }

  .article-title {
    font-size: 24px;
    line-height: 34px;
  }

  .article-head {
    margin-bottom: var(--space-4);
  }

  .article-paragraph {
    font-size: 16px;
    line-height: 29px;
  }
}
</style>
