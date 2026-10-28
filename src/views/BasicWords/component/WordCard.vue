<script setup>
/**
 * 基础词卡片
 *
 * 用途：一张卡展示一个词条，四个槽位固定——单词 / 音标或英文全称 / 释义或中文全称 /
 *       底部类型徽标 + 状态。四类词（实词、功能词、日历词、缩写）只换内容不换版式，
 *       这样同一行的卡片高度一致、状态标签能对成一条线（md/16 §6.1）。
 * 用法：<WordCard :item="item" />
 *
 * props:
 *   item — 基础词表接口返回的单条记录
 */
import { computed } from 'vue'
import StatusPill from '../../../component/StatusPill.vue'
import { meaningOf, metaOf, statusOf } from '../../../unit/basic-words'
import { phoneticParts } from '../../../unit/phonetic'

const props = defineProps({
  item: { type: Object, required: true },
})

const isAbbreviation = computed(() => Boolean(props.item.kinds?.includes('abbreviation')))
const isFunctionWord = computed(() => Boolean(props.item.isFunctionWord))

// 缩写没有音标也没有义项，第二三行换成英文全称与中文释义
const phonetics = computed(() => phoneticParts(props.item.phonetic))
const expansion = computed(() => (isAbbreviation.value ? props.item.expansion || '' : ''))
const meaning = computed(() =>
  isAbbreviation.value ? props.item.expansionMeaning || '' : meaningOf(props.item),
)
const meta = computed(() => metaOf(props.item))
const status = computed(() => statusOf(props.item))
</script>

<template>
  <article class="word-card" :class="{ 'is-function': isFunctionWord }">
    <h3 class="card-word">{{ item.word }}</h3>

    <p v-if="expansion" class="card-line is-expansion" lang="en">{{ expansion }}</p>
    <p v-else-if="phonetics.length" class="card-line is-phonetic" lang="en">
      <span v-for="part in phonetics" :key="part.label" class="phonetic-part">
        {{ part.label }} {{ part.value }}
      </span>
    </p>

    <p v-if="meaning" class="card-line is-meaning" :title="meaning">{{ meaning }}</p>

    <footer class="card-foot">
      <span v-if="meta" class="card-meta" :title="meta.hint">{{ meta.label }}</span>
      <span v-else class="card-meta-space" aria-hidden="true" />
      <StatusPill :value="status.value" :label="status.label" />
    </footer>
  </article>
</template>

<style scoped>
.word-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 142px;
  padding: var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  transition: border-color var(--dur-fast) var(--ease-out);
}

.word-card:hover {
  border-color: var(--color-line-strong);
}

.card-word {
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 500;
  line-height: 28px;
  letter-spacing: 0.01em;
  /* 长词截断，避免把整行卡片撑宽 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-line {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.is-phonetic {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  min-height: 17px;
}

.is-meaning {
  display: -webkit-box;
  overflow: hidden;
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

/* 缩写的全称可能很长（United States of America），给两行 */
.is-expansion {
  display: -webkit-box;
  overflow: hidden;
  font-size: var(--text-small);
  line-height: var(--leading-small);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: auto;
  padding-top: var(--space-1);
}

.card-meta {
  overflow: hidden;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--color-bg-deep);
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta-space {
  flex: 1;
}
</style>
