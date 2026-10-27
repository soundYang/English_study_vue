<script setup>
/**
 * 词库候选列表
 *
 * 用途：单词输入框下方的联想列表，展示词头、音标、首个义项与义项总数；
 *       键盘高亮由父组件通过 activeIndex 驱动，本组件只负责渲染与点击。
 * 用法：<WordSuggestList
 *         :list-id="listId"
 *         :items="suggestions"
 *         :active-index="activeIndex"
 *         :state="searchState"
 *         @select="selectEntry"
 *         @hover="activeIndex = $event"
 *       />
 *
 * props:
 *   listId      — 列表 id，供输入框 aria-controls 关联
 *   items       — 词条数组
 *   activeIndex — 当前键盘高亮项下标，-1 表示无
 *   state       — idle / loading / ready / empty / failed
 * emits:
 *   select — 点击或回车选中词条
 *   hover  — 鼠标移入某一项，参数为下标
 *
 * 交互约定：选项使用 @mousedown.prevent，避免输入框先失焦导致点击丢失。
 */
import SkeletonBlock from '../../../component/SkeletonBlock.vue'

const props = defineProps({
  listId: { type: String, required: true },
  items: { type: Array, default: () => [] },
  activeIndex: { type: Number, default: -1 },
  state: { type: String, default: 'idle' },
})

const emit = defineEmits(['select', 'hover'])

function optionId(index) {
  return `${props.listId}-option-${index}`
}

function extraCount(entry) {
  return Math.max(0, entry.senses.length - 1)
}
</script>

<template>
  <div :id="listId" class="suggest" role="listbox" aria-label="词库候选">
    <template v-if="state === 'loading'">
      <div
        v-for="row in 2"
        :key="`skeleton-${row}`"
        class="suggest-row is-skeleton"
        aria-hidden="true"
      >
        <SkeletonBlock width="88px" height="14px" />
        <SkeletonBlock width="76px" height="12px" />
        <SkeletonBlock width="120px" height="12px" />
      </div>
    </template>

    <template v-else-if="state === 'empty' || state === 'failed'">
      <p class="suggest-note" role="status">
        <template v-if="state === 'empty'">词库未收录，可直接保存为手动条目</template>
        <template v-else>词库暂时不可用，可直接手动添加</template>
      </p>
    </template>

    <template v-else>
      <button
        v-for="(entry, index) in items"
        :id="optionId(index)"
        :key="entry.id"
        type="button"
        role="option"
        class="suggest-row"
        :class="{ 'is-active': index === activeIndex }"
        :aria-selected="index === activeIndex"
        tabindex="-1"
        @mousedown.prevent
        @mouseenter="emit('hover', index)"
        @click="emit('select', entry)"
      >
        <span class="suggest-line">
          <span class="suggest-word" lang="en">{{ entry.headword }}</span>
          <span class="suggest-phonetic" lang="en">{{ entry.phonetic.uk || '—' }}</span>
        </span>
        <span class="suggest-sense">
          <span v-if="entry.senses[0]?.pos" class="suggest-pos">{{ entry.senses[0].pos }}</span>
          <span class="suggest-meaning">{{ entry.senses[0]?.meaning }}</span>
          <span v-if="extraCount(entry)" class="suggest-extra"
            >等 {{ entry.senses.length }} 条</span
          >
        </span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.suggest {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  z-index: 20;
  max-height: 320px;
  overflow-y: auto;
  padding: var(--space-1);
  border: 1px solid var(--color-line-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

/* 表单栏只有约 280px 宽，三列会把词头和音标一起截断，改为两行铺满 */
.suggest-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 8px var(--space-3);
  border-radius: var(--radius-sm);
  text-align: left;
  transition: background-color var(--dur-fast) var(--ease-out);
}

.suggest-row.is-skeleton {
  flex-direction: row;
  align-items: center;
  gap: var(--space-3);
  padding-top: 10px;
  padding-bottom: 10px;
}

.suggest-line {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  min-width: 0;
}

.suggest-row.is-active {
  background: var(--color-surface-2);
  box-shadow: inset 2px 0 0 var(--color-primary);
}

.suggest-word {
  flex: none;
  font-size: 15px;
  font-weight: 500;
  line-height: 22px;
}

.suggest-phonetic {
  overflow: hidden;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suggest-sense {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.suggest-pos {
  flex: none;
  color: var(--color-accent);
  font-size: var(--text-caption);
}

.suggest-meaning {
  color: var(--color-ink-2);
  overflow-wrap: anywhere;
}

.suggest-extra {
  flex: none;
  color: var(--color-muted);
  font-size: var(--text-caption);
}

.suggest-note {
  padding: var(--space-3);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

@media (max-width: 767px) {
  /* 弹层内输入框是整宽，候选行留出更多点击高度 */
  .suggest-row {
    padding-top: 10px;
    padding-bottom: 10px;
  }
}
</style>
