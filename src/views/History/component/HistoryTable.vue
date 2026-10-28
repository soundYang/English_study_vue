<script setup>
/**
 * 历史记录表（桌面端）
 * 展示日期、文章标题、难度、题数、正确率与操作；未提交记录显示“未提交”，不展示判分。
 * 整行可点击，操作列提供键盘可达的按钮；小于 768px 由 HistoryMobileList 接管。
 *
 * 用法：<HistoryTable :items="items" :loading="loading" @open="openItem" />
 *
 * props:
 *   items   — 历史记录数组
 *   loading — 加载中显示 8 行骨架
 * emits:
 *   open — 打开记录，参数为记录对象
 */
import SkeletonBlock from '../../../component/SkeletonBlock.vue'
import StatusPill from '../../../component/StatusPill.vue'
import { formatDate, formatPercent } from '../../../unit/format'

defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['open'])

function isSubmitted(item) {
  return item.status === 'submitted'
}

function open(item) {
  emit('open', item)
}

function rowDelay(index) {
  return { '--row-delay': `${Math.min(index, 9) * 25}ms` }
}
</script>

<template>
  <div class="history-table-wrap">
    <table class="history-table">
      <caption class="sr-only">
        练习记录
      </caption>
      <colgroup>
        <col class="col-date" />
        <col class="col-title" />
        <col class="col-level" />
        <col class="col-count" />
        <col class="col-accuracy" />
        <col class="col-action" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">时间</th>
          <th scope="col">文章标题</th>
          <th scope="col">难度</th>
          <th scope="col">题目数量</th>
          <th scope="col">正确率</th>
          <th scope="col" class="action-head">操作</th>
        </tr>
      </thead>

      <tbody v-if="loading">
        <tr v-for="row in 8" :key="`skeleton-${row}`" class="skeleton-row">
          <td><SkeletonBlock width="76px" height="14px" /></td>
          <td><SkeletonBlock width="64%" height="14px" /></td>
          <td><SkeletonBlock width="52px" height="22px" radius="var(--radius-pill)" /></td>
          <td><SkeletonBlock width="28px" height="14px" /></td>
          <td><SkeletonBlock width="44px" height="14px" /></td>
          <td><SkeletonBlock width="56px" height="14px" /></td>
        </tr>
      </tbody>

      <tbody v-else>
        <tr
          v-for="(item, index) in items"
          :key="item.id"
          class="history-row"
          :style="rowDelay(index)"
          @click="open(item)"
        >
          <td class="cell-date">
            {{ formatDate(item.submittedAt || item.createdAt) }}
            <!-- token 挂在日期下方，不额外占一列；老数据没有该字段就不显示 -->
            <span v-if="item.tokenUsage?.totalTokens" class="cell-token">
              {{ item.tokenUsage.totalTokens }} tok
            </span>
          </td>
          <td class="cell-title">
            <span :title="item.title">{{ item.title }}</span>
          </td>
          <td>
            <StatusPill kind="level" :value="item.level" />
          </td>
          <td class="cell-count">{{ item.questionCount }}</td>
          <td>
            <span v-if="isSubmitted(item)" class="cell-accuracy">
              {{ formatPercent(item.accuracy) }}
            </span>
            <StatusPill v-else kind="status" value="unsubmitted" label="未提交" />
          </td>
          <td class="cell-action">
            <button
              type="button"
              class="row-action"
              :aria-label="`${isSubmitted(item) ? '查看' : '继续答题'}：${item.title}`"
              @click.stop="open(item)"
            >
              {{ isSubmitted(item) ? '查看' : '继续答题' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.history-table-wrap {
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.history-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.col-date {
  width: 16%;
}

.col-title {
  width: 30%;
}

.col-level {
  width: 12%;
}

.col-count {
  width: 10%;
}

.col-accuracy {
  width: 14%;
}

.col-action {
  width: 18%;
}

.history-table th {
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

.action-head {
  text-align: right;
}

.history-table td {
  height: 56px;
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--color-line);
  font-size: 14px;
  line-height: 22px;
}

.history-table tbody tr:last-child td {
  border-bottom: none;
}

.history-row {
  cursor: pointer;
  animation: history-row-in var(--dur-base) var(--ease-out) both;
  animation-delay: var(--row-delay, 0ms);
  transition: background-color var(--dur-fast) var(--ease-out);
}

.history-row:hover {
  background: var(--color-surface-2);
}

.cell-date {
  color: var(--color-muted);
  font-size: var(--text-small);
}

.cell-token {
  display: block;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.cell-title span {
  display: block;
  overflow: hidden;
  color: var(--color-ink);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-count,
.cell-accuracy {
  color: var(--color-ink-2);
}

.cell-accuracy {
  font-weight: 500;
}

.cell-action {
  text-align: right;
}

.row-action {
  padding: var(--space-1) 0;
  color: var(--color-accent);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  white-space: nowrap;
  transition: color var(--dur-fast) var(--ease-out);
}

.row-action:hover {
  color: var(--color-primary);
}

.skeleton-row td {
  border-bottom: 1px solid var(--color-line);
}

@keyframes history-row-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 767px) {
  .history-table-wrap {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .history-row {
    animation: none;
  }
}
</style>
