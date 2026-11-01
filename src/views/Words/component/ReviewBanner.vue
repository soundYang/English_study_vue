<script setup>
/**
 * 今日复习入口条
 *
 * 用途：词汇页顶部提示今天到期的复习量，并进入复习页（md/56 P1、md/22 第 90 行）。
 * 用法：<ReviewBanner :remaining="plan.review.remaining" :today="plan.review.today" :done="plan.review.doneToday" />
 *
 * 三态：
 *   有到期词      → 主文案 + 「开始复习」
 *   没有到期、今天复习过 → 完成态，不给按钮
 *   两者皆无 / 未加载   → 不渲染（不留空白，也不报错）
 *
 * props:
 *   remaining — 积压总量；null/undefined 视为未加载
 *   today     — 今天建议复习数（上限 50），只在 remaining > today 时提示顺延
 *   done      — 今天已复习的词次
 *   to        — 复习页地址
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight } from 'lucide-vue-next'

const props = defineProps({
  remaining: { type: Number, default: null },
  today: { type: Number, default: 0 },
  done: { type: Number, default: 0 },
  to: { type: String, default: '/words/review' },
})

const remaining = computed(() => Math.max(0, Number(props.remaining) || 0))
const done = computed(() => Math.max(0, Number(props.done) || 0))
const pending = computed(() => remaining.value > 0)
// 未加载（remaining 为 null）时不渲染；有到期词或今天复习过才出现
const visible = computed(() => props.remaining != null && (pending.value || done.value > 0))
const overflow = computed(() => pending.value && props.today < remaining.value)
</script>

<template>
  <section v-if="visible" class="review-banner" :class="{ 'is-done': !pending }">
    <div class="banner-copy">
      <p class="banner-title">
        <template v-if="pending">今天有 {{ remaining }} 个单词到期待复习</template>
        <template v-else>今天的复习完成了</template>
      </p>
      <p class="banner-meta">
        <template v-if="pending">今天已完成 {{ done }} 次</template>
        <template v-else>今天复习了 {{ done }} 次，明天再来。</template>
      </p>
      <p v-if="overflow" class="banner-hint">今天先复习 {{ today }} 个，剩下的顺延到明天。</p>
    </div>

    <RouterLink v-if="pending" class="banner-action" :to="to">
      <span>开始复习</span>
      <ArrowRight :size="16" :stroke-width="1.8" aria-hidden="true" />
    </RouterLink>
  </section>
</template>

<style scoped>
/*
 * 复习是「今天该做的事」，用 accent 的浅底把它与页面其余部分区分开；
 * 完成态收成中性色，避免已经做完还一直抢注意力。
 */
.review-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-top: var(--space-6);
  padding: var(--space-4) var(--space-5);
  border: 1px solid color-mix(in srgb, var(--color-accent) 32%, var(--color-line));
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface));
}

.review-banner.is-done {
  border-color: var(--color-line);
  background: var(--color-surface);
}

.banner-title {
  color: var(--color-ink);
  font-size: var(--text-body);
  font-weight: 500;
  line-height: var(--leading-body);
}

.banner-meta {
  margin-top: 2px;
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.banner-hint {
  margin-top: var(--space-2);
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.banner-action {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-primary-ink);
  font-size: var(--text-small);
  font-weight: 500;
  text-decoration: none;
  transition: filter 160ms var(--ease-out);
}

.banner-action:hover {
  filter: brightness(1.06);
}

.banner-action:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

@media (max-width: 767px) {
  .review-banner {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-4);
  }
}
</style>
