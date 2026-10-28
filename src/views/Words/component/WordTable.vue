<script setup>
/**
 * 词汇列表
 *
 * 用途：桌面端表格 + 小于 768px 的卡片列表，覆盖骨架屏、错误卡与新增/编辑高亮
 * 用法：<WordTable :items="items" :loading="loading" :error="error" :highlight-id="id"
 *          :expanded-word="expandedWord"
 *          @edit="openEdit" @remove="askDelete" @retry="fetch" @detail="openDetail" />
 *
 * props:
 *   items        — 词汇数组
 *   loading      — 加载中，表头保留并显示 8 行骨架
 *   error        — 错误文案，存在时整块替换为错误卡
 *   highlightId  — 新增/编辑后需要高亮的行 id
 *   expandedWord — 详情浮层当前显示的单词，用来同步 aria-expanded
 * emits:
 *   edit — 点击编辑，参数为词汇对象
 *   remove — 点击删除，参数为词汇对象
 *   retry — 错误卡中的重试
 *   detail — 点击单词查看详情，参数 { item, anchor }
 */
import { Pencil, Trash2 } from 'lucide-vue-next'
import BaseButton from '../../../component/BaseButton.vue'
import SkeletonBlock from '../../../component/SkeletonBlock.vue'
import StatusPill from '../../../component/StatusPill.vue'
import { formatDate } from '../../../unit/format'
import { phoneticParts } from '../../../unit/phonetic'
import { frequencyTierOf } from '../../../unit/word-tiers'

/** 词频档位；手填词没有 cocaRank，返回 null 时不渲染徽标 */
function tierOf(item) {
  return frequencyTierOf(item.cocaRank)
}

function firstSense(item) {
  return item.senses?.[0] || null
}

/** 首个义项之外还有几条，用于"+N"提示 */
function extraSenseCount(item) {
  return Math.max(0, (item.senses?.length || 0) - 1)
}

defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  highlightId: { type: String, default: '' },
  expandedWord: { type: String, default: '' },
})

const emit = defineEmits(['edit', 'remove', 'retry', 'detail'])

function detail(item, event) {
  emit('detail', { item, anchor: event.currentTarget })
}

function edit(item) {
  emit('edit', item)
}

function remove(item) {
  emit('remove', item)
}

function retry() {
  emit('retry')
}

function rowDelay(index) {
  return { '--row-delay': `${Math.min(index, 9) * 30}ms` }
}
</script>

<template>
  <div v-if="error" class="state-card" role="alert">
    <p class="state-title">词汇加载失败</p>
    <p class="state-desc">{{ error }}</p>
    <BaseButton variant="secondary" @click="retry">重试</BaseButton>
  </div>

  <template v-else>
    <div class="word-table-wrap">
      <table class="word-table">
        <caption class="sr-only">
          单词列表
        </caption>
        <colgroup>
          <col class="col-word" />
          <col class="col-phonetic" />
          <col class="col-meaning" />
          <col class="col-status" />
          <col class="col-created" />
          <col class="col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">英文</th>
            <th scope="col">音标</th>
            <th scope="col">词性 · 释义</th>
            <th scope="col">学习状态</th>
            <th scope="col">收录</th>
            <th scope="col" class="actions-head">操作</th>
          </tr>
        </thead>

        <tbody v-if="loading">
          <tr v-for="row in 8" :key="`skeleton-${row}`" class="skeleton-row">
            <td><SkeletonBlock width="58%" height="14px" /></td>
            <td><SkeletonBlock width="76%" height="12px" /></td>
            <td><SkeletonBlock width="74%" height="14px" /></td>
            <td><SkeletonBlock width="64px" height="22px" radius="var(--radius-pill)" /></td>
            <td><SkeletonBlock width="72px" height="12px" /></td>
            <td><SkeletonBlock width="64px" height="22px" /></td>
          </tr>
        </tbody>

        <TransitionGroup v-else name="word-item" tag="tbody">
          <tr
            v-for="(item, index) in items"
            :key="item.id"
            class="word-row"
            :class="{ 'is-highlight': item.id === highlightId }"
            :style="rowDelay(index)"
          >
            <td class="cell-word">
              <button
                type="button"
                class="word-text"
                aria-haspopup="dialog"
                :aria-expanded="item.word === expandedWord ? 'true' : 'false'"
                :aria-label="`查看 ${item.word} 的详细信息`"
                @click="detail(item, $event)"
              >
                {{ item.word }}
              </button>
              <span class="word-source" :class="`is-${item.source}`">
                {{ item.source === 'dictionary' ? '词库' : '手填' }}
              </span>
              <span v-if="tierOf(item)" class="word-freq" :class="`is-${tierOf(item).key}`">
                {{ tierOf(item).label }}
              </span>
            </td>
            <td
              class="cell-phonetic"
              :class="{ 'is-empty': !phoneticParts(item.phonetic).length }"
              lang="en"
            >
              <template v-if="phoneticParts(item.phonetic).length">
                <span
                  v-for="part in phoneticParts(item.phonetic)"
                  :key="part.label"
                  class="phonetic-part"
                >
                  {{ part.label }} {{ part.value }}
                </span>
              </template>
              <template v-else>—</template>
            </td>
            <td class="cell-meaning" :class="{ 'is-empty': !firstSense(item) }">
              <template v-if="firstSense(item)">
                <span v-if="firstSense(item).pos" class="sense-pos">
                  {{ firstSense(item).pos }}
                </span>
                <span class="sense-text">{{ firstSense(item).meaning || '—' }}</span>
                <span v-if="extraSenseCount(item)" class="sense-more">
                  +{{ extraSenseCount(item) }}
                </span>
              </template>
              <template v-else>—</template>
            </td>
            <td>
              <StatusPill kind="status" :value="item.status" />
            </td>
            <td class="cell-created">{{ formatDate(item.createdAt) }}</td>
            <td>
              <div class="row-actions">
                <button
                  type="button"
                  class="row-action"
                  :aria-label="`编辑 ${item.word}`"
                  @click="edit(item)"
                >
                  <Pencil :size="15" :stroke-width="1.8" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="row-action is-danger"
                  :aria-label="`删除 ${item.word}`"
                  @click="remove(item)"
                >
                  <Trash2 :size="15" :stroke-width="1.8" aria-hidden="true" />
                </button>
              </div>
            </td>
          </tr>
        </TransitionGroup>
      </table>
    </div>

    <ul v-if="loading" class="word-cards" aria-hidden="true">
      <li v-for="row in 4" :key="`card-skeleton-${row}`" class="word-card">
        <div class="card-text">
          <SkeletonBlock width="42%" height="15px" />
          <SkeletonBlock width="66%" height="13px" />
        </div>
        <SkeletonBlock width="64px" height="22px" radius="var(--radius-pill)" />
      </li>
    </ul>

    <TransitionGroup v-else name="word-item" tag="ul" class="word-cards">
      <li
        v-for="(item, index) in items"
        :key="item.id"
        class="word-card"
        :class="{ 'is-highlight': item.id === highlightId }"
        :style="rowDelay(index)"
      >
        <div class="card-text">
          <span class="card-line">
            <button
              type="button"
              class="card-word"
              aria-haspopup="dialog"
              :aria-expanded="item.word === expandedWord ? 'true' : 'false'"
              :aria-label="`查看 ${item.word} 的详细信息`"
              @click="detail(item, $event)"
            >
              {{ item.word }}
            </button>
            <span class="word-source" :class="`is-${item.source}`">
              {{ item.source === 'dictionary' ? '词库' : '手填' }}
            </span>
            <span v-if="tierOf(item)" class="word-freq" :class="`is-${tierOf(item).key}`">
              {{ tierOf(item).label }}
            </span>
          </span>
          <span
            class="card-phonetic"
            :class="{ 'is-empty': !phoneticParts(item.phonetic).length }"
            lang="en"
          >
            <template v-if="phoneticParts(item.phonetic).length">
              <span
                v-for="part in phoneticParts(item.phonetic)"
                :key="part.label"
                class="phonetic-part"
              >
                {{ part.label }} {{ part.value }}
              </span>
            </template>
            <template v-else>—</template>
          </span>
          <span class="card-meaning" :class="{ 'is-empty': !firstSense(item) }">
            <template v-if="firstSense(item)">
              <span v-if="firstSense(item).pos" class="sense-pos">{{ firstSense(item).pos }}</span>
              {{ firstSense(item).meaning || '—' }}
              <span v-if="extraSenseCount(item)" class="sense-more">
                +{{ extraSenseCount(item) }}
              </span>
            </template>
            <template v-else>—</template>
          </span>
          <span class="card-created">收录 {{ formatDate(item.createdAt) }}</span>
        </div>

        <StatusPill kind="status" :value="item.status" />

        <div class="row-actions is-on-card">
          <button
            type="button"
            class="row-action"
            :aria-label="`编辑 ${item.word}`"
            @click="edit(item)"
          >
            <Pencil :size="15" :stroke-width="1.8" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="row-action is-danger"
            :aria-label="`删除 ${item.word}`"
            @click="remove(item)"
          >
            <Trash2 :size="15" :stroke-width="1.8" aria-hidden="true" />
          </button>
        </div>
      </li>
    </TransitionGroup>
  </template>
</template>

<style scoped>
.word-table-wrap {
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.word-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.col-word {
  width: 18%;
}

.col-phonetic {
  width: 16%;
}

.col-meaning {
  width: 30%;
}

.col-status {
  width: 13%;
}

.col-created {
  width: 10%;
}

.col-actions {
  width: 112px;
}

.word-table th {
  height: 40px;
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--color-line);
  color: var(--color-muted);
  font-size: var(--text-caption);
  font-weight: 400;
  line-height: var(--leading-caption);
  text-align: left;
  letter-spacing: 0.04em;
}

.actions-head {
  text-align: right;
}

.word-table td {
  height: 52px;
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--color-line);
  font-size: 14px;
  line-height: 22px;
  overflow-wrap: anywhere;
  transition: background-color 800ms linear;
}

.word-row {
  animation: word-row-in var(--dur-base) var(--ease-out) both;
  animation-delay: var(--row-delay, 0ms);
  transition: background-color var(--dur-fast) var(--ease-out);
}

.word-row:hover {
  background: var(--color-surface-2);
}

.word-row.is-highlight td,
.word-card.is-highlight {
  background: var(--color-success-bg);
}

/* 词形 + 来源 + 词频挤在一列，允许换行，长词不会被徽标顶出格子 */
.cell-word {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  align-items: baseline;
}

/* 单词本身就是详情入口：去掉按钮默认外观，保留正文排版，悬停下划线提示可点 */
.word-text {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  line-height: inherit;
  text-align: left;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  cursor: pointer;
  transition:
    color var(--dur-fast) var(--ease-out),
    text-decoration-color var(--dur-fast) var(--ease-out);
}

.word-text:hover {
  color: var(--color-accent);
  text-decoration-color: currentColor;
}

/* 来源决定这条词能不能编辑释义，值得一个常驻徽标；词频只是参考信息，做成弱标签 */
.word-source {
  padding: 0 6px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  line-height: 18px;
  white-space: nowrap;
}

.word-source.is-dictionary {
  background: var(--color-bg-deep);
  color: var(--color-accent);
}

.word-source.is-manual {
  background: var(--color-surface-2);
  color: var(--color-muted);
}

.word-freq {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  white-space: nowrap;
}

.word-freq.is-high {
  color: var(--color-success);
}

.word-freq.is-mid {
  color: var(--color-muted);
}

.word-freq.is-low {
  color: var(--color-warning);
}

.cell-phonetic {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

/* 英式在上、美式在下；两式只有一份时自然只占一行 */
.phonetic-part {
  display: block;
}

.cell-created {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  white-space: nowrap;
}

.cell-phonetic.is-empty,
.card-phonetic.is-empty {
  color: var(--color-muted);
}

.cell-meaning {
  color: var(--color-ink-2);
}

.cell-meaning.is-empty,
.card-meaning.is-empty {
  color: var(--color-muted);
}

/* 词性用强调色区分，释义保持正文色，避免整列像一串标签 */
.sense-pos {
  margin-right: 4px;
  color: var(--color-accent);
  font-size: var(--text-caption);
}

.sense-more {
  margin-left: 4px;
  color: var(--color-muted);
  font-size: var(--text-caption);
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-1);
}

.row-action {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  color: var(--color-ink-2);
  /* 0.45 时图标对白底仅 2.23:1，低于控件 3:1；0.7 为 3.92:1 仍弱于正文 */
  opacity: 0.7;
  transition:
    opacity var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.word-row:hover .row-action,
.row-action:focus-visible {
  opacity: 1;
}

.row-action:hover {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.row-action.is-danger:hover {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.skeleton-row td {
  border-bottom: 1px solid var(--color-line);
}

.word-cards {
  display: none;
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
  overflow-wrap: anywhere;
}

.word-item-enter-active {
  animation: word-row-in var(--dur-base) var(--ease-out) both;
  animation-delay: var(--row-delay, 0ms);
}

.word-item-leave-active {
  transition: opacity var(--dur-base) var(--ease-in-out);
}

.word-item-leave-to {
  opacity: 0;
}

.word-item-move {
  transition: transform var(--dur-base) var(--ease-in-out);
}

@keyframes word-row-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (hover: none) {
  .row-action {
    opacity: 1;
  }
}

@media (max-width: 767px) {
  .word-table-wrap {
    display: none;
  }

  .word-cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .word-card {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    transition: background-color 800ms linear;
  }

  .card-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .card-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px var(--space-2);
    min-width: 0;
  }

  .card-word {
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font-family: inherit;
    font-size: 15px;
    font-weight: 500;
    line-height: 22px;
    text-align: left;
    text-decoration: underline;
    text-decoration-color: transparent;
    text-underline-offset: 3px;
    overflow-wrap: anywhere;
    cursor: pointer;
  }

  .card-word:hover {
    color: var(--color-accent);
    text-decoration-color: currentColor;
  }

  .card-phonetic {
    display: flex;
    flex-wrap: wrap;
    gap: 2px var(--space-2);
    color: var(--color-muted);
    font-size: var(--text-caption);
    line-height: var(--leading-caption);
  }

  /* 卡片上音标并排更省高度，换行由 flex-wrap 兜住 */
  .card-phonetic .phonetic-part {
    display: inline;
  }

  .card-created {
    color: var(--color-muted);
    font-size: var(--text-caption);
    line-height: var(--leading-caption);
  }

  .card-meaning {
    color: var(--color-ink-2);
    font-size: var(--text-small);
    line-height: var(--leading-small);
    overflow-wrap: anywhere;
  }

  .row-actions.is-on-card .row-action {
    width: 44px;
    height: 44px;
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .word-row,
  .word-item-enter-active {
    animation-delay: 0ms !important;
  }
}
</style>
