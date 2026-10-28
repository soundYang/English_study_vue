<script setup>
/**
 * 未学单词面板
 *
 * 用途：折叠展示本文出现、但不在用户词库里的词，供阅读前扫一眼
 * 用法：<NewWordsPanel :words="reading.newWords" />
 *
 * 用原生 <details>：键盘可达、读屏正常、零 JS 状态，不需要自研折叠动画。
 *
 * props:
 *   words — 后端 newWords 数组（word / phonetic / senses / source），为空时不渲染
 */
import { computed } from 'vue'

const props = defineProps({
  words: { type: Array, default: () => [] },
})

const items = computed(() =>
  props.words.map((item) => ({
    word: item.word,
    phonetic: item.phonetic?.uk || item.phonetic?.us || '',
    meaning: (item.senses || [])
      .map((sense) => sense.meaning)
      .filter(Boolean)
      .join('；'),
    // 缩写只显示原词：展开后的释义是碎片，摆出来反而干扰阅读
    plain: item.source === 'abbreviation',
  })),
)
</script>

<template>
  <details v-if="items.length" class="new-words">
    <summary class="new-words-summary">本文含 {{ items.length }} 个未学单词</summary>

    <ul class="new-words-list">
      <li v-for="item in items" :key="item.word" class="new-word">
        <span class="new-word-text" lang="en">{{ item.word }}</span>
        <span v-if="item.phonetic && !item.plain" class="new-word-phonetic" lang="en">
          {{ item.phonetic }}
        </span>
        <span v-if="!item.plain && item.meaning" class="new-word-meaning">{{ item.meaning }}</span>
      </li>
    </ul>
  </details>
</template>

<style scoped>
.new-words {
  margin-top: var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.new-words-summary {
  padding: var(--space-3) var(--space-4);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  cursor: pointer;
}

.new-words-summary:hover {
  color: var(--color-ink-2);
}

.new-words-list {
  margin: 0;
  padding: 0 var(--space-4) var(--space-4);
  list-style: none;
}

.new-word {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: baseline;
  padding: var(--space-2) 0;
  border-top: 1px solid var(--color-line);
}

.new-word-text {
  color: var(--color-ink);
  font-weight: 500;
}

.new-word-phonetic {
  color: var(--color-muted);
  font-size: var(--text-small);
}

.new-word-meaning {
  color: var(--color-ink-2);
  font-size: var(--text-small);
}
</style>
