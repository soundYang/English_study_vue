<script setup>
/**
 * 基础词卡片
 *
 * 用途：一张卡展示一个词条，四个槽位固定——单词 / 音标或英文全称 / 释义或中文全称 /
 *       底部类型徽标 + 状态。四类词（基础词、功能词、日期词、缩写）只换内容不换版式，
 *       每张卡都有徽标，同一行卡片高度一致、状态标签能对成一条线（md/16 §6.1、md/52）。
 * 用法：<WordCard :item="item" :pending="pendingWord === item.word"
 *          :expanded="expandedWord === item.word"
 *          @select="onSelect" @detail="onDetail" />
 *
 * props:
 *   item     — 基础词表接口返回的单条记录
 *   pending  — 该词的写请求进行中
 *   expanded — 详情浮层当前显示的是这个词
 *   readonly — 游客态：不渲染个人状态 pill 与操作菜单，只保留公开词条内容
 * emits:
 *   select — 菜单动作，参数 { item, type }，type 为 known / unknown / none，确认与提交由页面决定
 *   detail — 查看详情，参数 { item, anchor }，anchor 是单词按钮
 */
import { computed } from 'vue'
import StatusPill from '../../../component/StatusPill.vue'
import { meaningOf, metaOf, statusOf } from '../../../unit/basic-words'
import { phoneticParts } from '../../../unit/phonetic'
import WordCardMenu from './WordCardMenu.vue'

const props = defineProps({
  item: { type: Object, required: true },
  pending: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'detail'])

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

function openDetail(event) {
  emit('detail', { item: props.item, anchor: event.currentTarget })
}
</script>

<template>
  <article
    class="word-card"
    :class="{ 'is-function': isFunctionWord, 'is-expanded': expanded }"
    :aria-busy="pending || undefined"
  >
    <header class="card-head">
      <h3 class="card-word">
        <button
          type="button"
          class="card-word-button"
          aria-haspopup="dialog"
          :aria-expanded="expanded ? 'true' : 'false'"
          :aria-label="`查看 ${item.word} 的详细信息`"
          @click="openDetail"
        >
          <span class="card-word-text">{{ item.word }}</span>
        </button>
      </h3>
      <WordCardMenu
        v-if="!readonly"
        :item="item"
        :pending="pending"
        @select="emit('select', { item, type: $event })"
      />
    </header>

    <p v-if="expansion" class="card-line is-expansion" lang="en">{{ expansion }}</p>
    <p v-else-if="phonetics.length" class="card-line is-phonetic" lang="en">
      <span v-for="part in phonetics" :key="part.label" class="phonetic-part">
        {{ part.label }} {{ part.value }}
      </span>
    </p>

    <p v-if="meaning" class="card-line is-meaning" :title="meaning">{{ meaning }}</p>

    <footer class="card-foot">
      <span class="card-meta" :title="meta.hint">{{ meta.label }}</span>
      <StatusPill v-if="!readonly" :value="status.value" :label="status.label" />
    </footer>
  </article>
</template>

<style scoped>
.word-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 142px;
  padding: var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-out);
}

.word-card:hover {
  border-color: var(--color-line-strong);
}

.word-card.is-expanded {
  border-color: var(--color-accent);
}

/* 键盘用户看不到铺满卡片的点击层，用整卡描边提示焦点 */
.word-card:has(.card-word-button:focus-visible) {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* 写请求在飞：卡片降透明度，和菜单的 progress 光标一起表示「正在处理」 */
.word-card[aria-busy='true'] {
  opacity: 0.72;
  transition: opacity var(--dur-fast) var(--ease-out);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.card-word {
  flex: 1;
  min-width: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 500;
  line-height: 28px;
  letter-spacing: 0.01em;
}

.card-word-button {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-align: left;
}

/* 点击层铺满整张卡片：点释义、音标、状态都能打开详情，⋮ 菜单在它上一层 */
.card-word-button::after {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: var(--radius-lg);
  content: '';
}

.card-word-button:focus-visible {
  outline: none;
}

.card-word-button:hover {
  color: var(--color-accent);
}

/* 长词截断，避免把整行卡片撑宽；不能放在 h3 上，否则会把点击层裁掉 */
.card-word-text {
  display: block;
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
</style>
