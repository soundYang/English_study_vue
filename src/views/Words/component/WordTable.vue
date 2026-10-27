<script setup>
/**
 * 词汇列表
 *
 * 用途：桌面端表格 + 小于 768px 的卡片列表，覆盖骨架屏、错误卡与新增/编辑高亮
 * 用法：<WordTable :items="items" :loading="loading" :error="error" :highlight-id="id"
 *          @edit="openEdit" @remove="askDelete" @retry="fetch" />
 *
 * props:
 *   items       — 词汇数组
 *   loading     — 加载中，表头保留并显示 8 行骨架
 *   error       — 错误文案，存在时整块替换为错误卡
 *   highlightId — 新增/编辑后需要高亮的行 id
 * emits:
 *   edit — 点击编辑，参数为词汇对象
 *   remove — 点击删除，参数为词汇对象
 *   retry — 错误卡中的重试
 */
import { Pencil, Trash2 } from 'lucide-vue-next'
import BaseButton from '../../../component/BaseButton.vue'
import SkeletonBlock from '../../../component/SkeletonBlock.vue'
import StatusPill from '../../../component/StatusPill.vue'

defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  highlightId: { type: String, default: '' },
})

const emit = defineEmits(['edit', 'remove', 'retry'])

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
          <col class="col-meaning" />
          <col class="col-status" />
          <col class="col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">英文</th>
            <th scope="col">中文释义</th>
            <th scope="col">学习状态</th>
            <th scope="col" class="actions-head">操作</th>
          </tr>
        </thead>

        <tbody v-if="loading">
          <tr v-for="row in 8" :key="`skeleton-${row}`" class="skeleton-row">
            <td><SkeletonBlock width="58%" height="14px" /></td>
            <td><SkeletonBlock width="74%" height="14px" /></td>
            <td><SkeletonBlock width="64px" height="22px" radius="var(--radius-pill)" /></td>
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
            <td class="cell-word">{{ item.word }}</td>
            <td class="cell-meaning" :class="{ 'is-empty': !item.meaning }">
              {{ item.meaning || '—' }}
            </td>
            <td>
              <StatusPill kind="status" :value="item.status" />
            </td>
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
          <span class="card-word">{{ item.word }}</span>
          <span class="card-meaning" :class="{ 'is-empty': !item.meaning }">
            {{ item.meaning || '—' }}
          </span>
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
  width: 28%;
}

.col-meaning {
  width: 34%;
}

.col-status {
  width: 18%;
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

.cell-word {
  font-size: 15px;
  font-weight: 500;
}

.cell-meaning {
  color: var(--color-ink-2);
}

.cell-meaning.is-empty,
.card-meaning.is-empty {
  color: var(--color-muted);
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
  opacity: 0.45;
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

  .card-word {
    font-size: 15px;
    font-weight: 500;
    line-height: 22px;
    overflow-wrap: anywhere;
  }

  .card-meaning {
    color: var(--color-ink-2);
    font-size: var(--text-small);
    line-height: var(--leading-small);
    overflow-wrap: anywhere;
  }

  .row-actions.is-on-card .row-action {
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
