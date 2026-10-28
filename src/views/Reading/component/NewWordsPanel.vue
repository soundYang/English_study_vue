<script setup>
/**
 * 未学单词面板
 *
 * 用途：列出本文出现、但不在用户词库里的词，供阅读前扫一眼或读中查证
 * 用法：<NewWordsPanel v-model:open="newWordsOpen" :words="reading.newWords" inline />
 *
 * 阅读页把它放在文章标题下方（`inline`，收起来只是一个胶囊），
 * 结果页沿用原来的卡片样式放在文章底部（默认折叠）。
 * 不用 `<details>`：展开状态归页面管，才能和「正文标注」等入口联动。
 *
 * props:
 *   words  — 后端 newWords 数组（word / phonetic / senses / source），为空时不渲染
 *   open   — 是否展开，配合 v-model:open 使用
 *   inline — 标题行内的胶囊样式，不画边框背景
 * emits:
 *   update:open — 点标题切换展开状态
 */
import { computed, ref, useId, watch } from 'vue'

const props = defineProps({
  words: { type: Array, default: () => [] },
  open: { type: Boolean, default: false },
  inline: { type: Boolean, default: false },
})

const emit = defineEmits(['update:open'])

// 同一页可能挂两个面板（未来结果页也开入口），id 用 useId 保唯一
const listId = `new-words-${useId()}`

// 阅读页用 v-model:open 接管展开状态；结果页没绑 v-model 时退化为组件内部状态，
// 否则 open 恒为 false，点标题永远展不开（结果页的「下拉」会失效）
const isOpen = ref(props.open)

watch(
  () => props.open,
  (value) => {
    isOpen.value = value
  },
)

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

function toggle() {
  isOpen.value = !isOpen.value
  emit('update:open', isOpen.value)
}
</script>

<template>
  <section v-if="items.length" class="new-words" :class="{ 'is-inline': inline }">
    <button
      type="button"
      class="new-words-toggle"
      :aria-controls="listId"
      :aria-expanded="isOpen ? 'true' : 'false'"
      @click="toggle"
    >
      <span class="new-words-title">本文含 {{ items.length }} 个未学单词</span>
      <span class="new-words-caret" aria-hidden="true">▾</span>
    </button>

    <ul v-if="isOpen" :id="listId" class="new-words-list">
      <li v-for="item in items" :key="item.word" class="new-word">
        <span class="new-word-text" lang="en">{{ item.word }}</span>
        <span v-if="item.phonetic && !item.plain" class="new-word-phonetic" lang="en">
          {{ item.phonetic }}
        </span>
        <span v-if="!item.plain && item.meaning" class="new-word-meaning">{{ item.meaning }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.new-words {
  margin-top: var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

/* 标题行里的胶囊：不占一整块，和词数排在同一行 */
.new-words.is-inline {
  margin-top: 0;
  border: 0;
  background: none;
}

.new-words-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 0;
  background: none;
  color: var(--color-muted);
  font: inherit;
  font-size: var(--text-small);
  line-height: var(--leading-small);
  text-align: left;
  cursor: pointer;
}

.new-words-toggle:hover {
  color: var(--color-ink-2);
}

.new-words.is-inline .new-words-toggle {
  width: auto;
  padding: 0;
  color: var(--color-accent);
}

.new-words-caret {
  display: inline-block;
  font-size: 10px;
  transition: transform var(--dur-fast) var(--ease-out);
}

.new-words-toggle[aria-expanded='true'] .new-words-caret {
  transform: rotate(180deg);
}

.new-words-toggle:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.new-words-list {
  margin: 0;
  padding: 0 var(--space-4) var(--space-4);
  list-style: none;
}

/* 展开后的清单在标题行里要自己收成一个盒子，否则会和正文混在一起 */
.new-words.is-inline .new-words-list {
  margin-top: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.new-word {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: baseline;
  padding: var(--space-2) 0;
  border-top: 1px solid var(--color-line);
}

.new-word:first-child {
  border-top: 0;
  padding-top: 0;
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
