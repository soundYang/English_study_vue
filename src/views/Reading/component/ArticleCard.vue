<script setup>
/**
 * 阅读文章卡
 *
 * 用途：以衬线正文展示英文文章，按空行拆段；传入未学词时正文里的这些词会加虚线标注。
 * 结果页传入 `translations` 时，每段英文正下方紧跟这一段的中文翻译（逐段对照）；
 * 阅读页不传，正文里不会出现任何中文。
 * 用法：<ArticleCard :title="reading.title" :article="reading.article"
 *         :highlight-words="reading.newWords" @word-click="openDetail">
 *         <template #meta><NewWordsPanel ... /></template>
 *       </ArticleCard>
 *
 * props:
 *   title          — 文章标题
 *   article        — 英文正文（不含答案与翻译）
 *   wordCount      — 后端 actualWords（真实词数）；为 0 时不渲染，兼容没有该字段的老数据
 *   titleTag       — 标题标签，默认 h1；结果页已有页面级 h1 时传 h2
 *   highlightWords — 未学词条目数组（读 `word` 字段）；为空时正文按纯文本渲染
 *   translations   — 逐段中文翻译，下标与 article 的段落一一对应；为空时不渲染中文
 * emits:
 *   word-click — 点正文里的未学词，参数 { entry, anchor }
 * slots:
 *   meta        — 标题下方的附加信息（阅读页放未学词入口）
 *   translation — 正文下方的附加内容（老结果页的整段翻译兜底；有逐段翻译时不传）
 */
import { computed, useSlots } from 'vue'
import { formatWordCount } from '../../../unit/format'
import { annotateParagraph, buildLookup } from '../../../unit/reading-words'

const props = defineProps({
  title: { type: String, default: '' },
  article: { type: String, default: '' },
  wordCount: { type: Number, default: 0 },
  titleTag: {
    type: String,
    default: 'h1',
    validator: (value) => ['h1', 'h2'].includes(value),
  },
  highlightWords: { type: Array, default: () => [] },
  translations: { type: Array, default: () => [] },
})

const emit = defineEmits(['word-click'])

const slots = useSlots()

const paragraphs = computed(() =>
  String(props.article)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean),
)

const lookup = computed(() => buildLookup(props.highlightWords))

const blocks = computed(() =>
  paragraphs.value.map((paragraph) => annotateParagraph(paragraph, lookup.value)),
)

// 后端保证 translations 与段落一一对应；这里再清洗一次，空串不会渲染成空白中文段
const translationBlocks = computed(() =>
  (Array.isArray(props.translations) ? props.translations : []).map((item) =>
    String(item ?? '').trim(),
  ),
)

// 没有词数也没有插槽时不渲染空行，避免标题下方多出一条间隙
const hasMeta = computed(() => props.wordCount > 0 || Boolean(slots.meta))

function openWord(token, event) {
  emit('word-click', { entry: token.entry, anchor: event.currentTarget })
}
</script>

<template>
  <article class="article-card">
    <header class="article-head">
      <component :is="titleTag" class="article-title">{{ title }}</component>

      <div v-if="hasMeta" class="article-meta-row">
        <p v-if="wordCount > 0" class="article-meta">{{ formatWordCount(wordCount) }}</p>
        <slot name="meta" />
      </div>
    </header>

    <div class="article-body">
      <div v-for="(tokens, index) in blocks" :key="index" class="article-block">
        <p class="article-paragraph">
          <template v-for="(token, position) in tokens" :key="position">
            <button
              v-if="token.entry"
              type="button"
              class="article-new-word"
              :aria-label="`查看 ${token.text} 的释义`"
              @click="openWord(token, $event)"
            >
              {{ token.text }}
            </button>
            <template v-else>{{ token.text }}</template>
          </template>
        </p>

        <!-- 逐段对照：中文紧贴所属英文段落，阅读页没有 translations，永不渲染 -->
        <p v-if="translationBlocks[index]" class="article-translation">
          {{ translationBlocks[index] }}
        </p>
      </div>
    </div>

    <slot name="translation" />
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

.article-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
}

.article-meta {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

/* 正文里的未学词：只加虚线下划线与浅底，不改变字重与字号，读起来不打断 */
.article-new-word {
  display: inline;
  padding: 0 1px;
  border: 0;
  border-bottom: 1px dashed var(--color-accent);
  background: none;
  color: inherit;
  font: inherit;
  line-height: inherit;
  text-align: inherit;
  overflow-wrap: anywhere;
  cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease-out);
}

.article-new-word:hover {
  background: var(--color-warning-bg);
}

.article-new-word:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
  border-radius: 2px;
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

/* 一段英文 + 它的中文翻译为一个块；块与块之间沿用原来的 18px */
.article-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* 中文弱于英文：小一档、弱化色；左侧细线表明它属于上一段，而不是新正文 */
.article-translation {
  padding-left: var(--space-3);
  border-left: 2px solid var(--color-line);
  color: var(--color-muted);
  font-size: var(--text-body);
  line-height: var(--leading-body);
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
