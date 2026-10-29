<script setup>
/**
 * 历史记录卡片列表（移动端）
 * 小于 768px 代替表格：标题、日期、难度、正确率与操作合并为整卡按钮，避免横向滚动。
 * 未提交记录只显示“未提交”，不泄露判分信息。
 *
 * 用法：<HistoryMobileList :items="items" :loading="loading" @open="openItem" />
 *
 * props:
 *   items   — 历史记录数组
 *   loading — 加载中显示 4 张骨架卡
 *   masked  — 游客态：渲染 4 张占位卡，点击整卡触发 login
 * emits:
 *   open  — 打开记录，参数为记录对象
 *   login — 游客点击占位卡，父级带去登录
 */
import { ArrowRight } from 'lucide-vue-next'
import GuestMask from '../../../component/GuestMask.vue'
import SkeletonBlock from '../../../component/SkeletonBlock.vue'
import StatusPill from '../../../component/StatusPill.vue'
import { formatDate, formatPercent } from '../../../unit/format'

defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  masked: { type: Boolean, default: false },
})

const emit = defineEmits(['open', 'login'])

const MASKED_CARDS = 4

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
  <ul v-if="loading" class="history-cards" aria-hidden="true">
    <li v-for="card in 4" :key="`skeleton-${card}`" class="history-card is-skeleton">
      <SkeletonBlock width="62%" height="15px" />
      <SkeletonBlock width="44%" height="13px" />
      <SkeletonBlock width="72%" height="22px" radius="var(--radius-pill)" />
    </li>
  </ul>

  <ul v-else-if="masked" class="history-cards">
    <li
      v-for="card in MASKED_CARDS"
      :key="`masked-${card}`"
      class="history-card-item"
      :style="rowDelay(card - 1)"
    >
      <button type="button" class="history-card" @click="emit('login')">
        <span class="card-top">
          <span class="card-title"><GuestMask /></span>
          <span class="guest-pill">难度</span>
        </span>

        <span class="card-meta">
          <span>----/--/--</span>
          <span aria-hidden="true">·</span>
          <span>-- 题</span>
        </span>

        <span class="card-bottom">
          <span class="card-accuracy">
            <GuestMask mode="number" /><span class="mask-unit">%</span>
          </span>

          <span class="card-action">
            登录后查看
            <ArrowRight :size="14" aria-hidden="true" />
          </span>
        </span>
      </button>
    </li>
  </ul>

  <ul v-else class="history-cards">
    <li
      v-for="(item, index) in items"
      :key="item.id"
      class="history-card-item"
      :style="rowDelay(index)"
    >
      <button type="button" class="history-card" @click="open(item)">
        <span class="card-top">
          <span class="card-title">{{ item.title }}</span>
          <StatusPill kind="level" :value="item.level" />
        </span>

        <span class="card-meta">
          <span>{{ formatDate(item.submittedAt || item.createdAt) }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ item.questionCount }} 题</span>
          <template v-if="item.tokenUsage?.totalTokens">
            <span aria-hidden="true">·</span>
            <span>{{ item.tokenUsage.totalTokens }} tok</span>
          </template>
        </span>

        <span class="card-bottom">
          <span v-if="isSubmitted(item)" class="card-accuracy">
            {{ formatPercent(item.accuracy) }}
          </span>
          <StatusPill v-else kind="status" value="unsubmitted" label="未提交" />

          <span class="card-action">
            {{ isSubmitted(item) ? '查看' : '继续答题' }}
            <ArrowRight :size="14" aria-hidden="true" />
          </span>
        </span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.history-cards {
  display: none;
}

@media (max-width: 767px) {
  .history-cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .history-card-item {
    animation: history-card-in var(--dur-base) var(--ease-out) both;
    animation-delay: var(--row-delay, 0ms);
  }

  .history-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-4);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    text-align: left;
    transition: border-color var(--dur-fast) var(--ease-out);
  }

  .history-card:hover {
    border-color: var(--color-line-strong);
  }

  .history-card.is-skeleton {
    gap: var(--space-2);
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .card-title {
    min-width: 0;
    overflow: hidden;
    color: var(--color-ink);
    font-size: 15px;
    font-weight: 500;
    line-height: 22px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-muted);
    font-size: var(--text-small);
    line-height: var(--leading-small);
  }

  .card-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-top: var(--space-1);
  }

  .card-accuracy {
    color: var(--color-ink-2);
    font-size: var(--text-small);
    font-weight: 500;
    line-height: var(--leading-small);
  }

  .card-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-accent);
    font-size: var(--text-small);
    line-height: var(--leading-small);
  }

  .guest-pill {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    height: 22px;
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--color-bg-deep);
    color: var(--color-muted);
    font-size: var(--text-caption);
    line-height: var(--leading-caption);
  }

  .mask-unit {
    margin-left: 2px;
    color: var(--color-muted);
    font-size: var(--text-caption);
  }
}

@keyframes history-card-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .history-card-item {
    animation: none;
  }
}
</style>
