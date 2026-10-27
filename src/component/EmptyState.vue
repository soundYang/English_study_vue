<script setup>
/**
 * 空状态
 *
 * 用途：列表无数据、搜索无结果时展示插画、说明与可选操作
 * 用法：<EmptyState title="还没有单词" description="先添加第一个单词，开始你的阅读训练。">
 *         <template #actions><BaseButton @click="add">添加单词</BaseButton></template>
 *       </EmptyState>
 *
 * props:
 *   title       — 主标题
 *   description — 说明文案
 *   image       — 可选图片地址（如 words-book.png）；不传时使用内置线稿
 *   imageAlt    — 图片替代文字，装饰图留空
 *   actionText  — 可选按钮文案，传入时渲染默认按钮
 *   compact     — 紧凑模式，减小上下留白
 * emits:
 *   action — 点击默认按钮时触发
 */
import BaseButton from './BaseButton.vue'

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  imageAlt: { type: String, default: '' },
  actionText: { type: String, default: '' },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['action'])

function handleAction() {
  emit('action')
}
</script>

<template>
  <div class="empty-state" :class="{ 'is-compact': compact }">
    <img v-if="image" class="empty-image" :src="image" :alt="imageAlt" loading="lazy" />
    <svg
      v-else
      class="empty-illustration"
      viewBox="0 0 96 96"
      width="96"
      height="96"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 30c10-6 20-6 30 0v42c-10-6-20-6-30 0V30Z"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linejoin="round"
      />
      <path
        d="M84 30c-10-6-20-6-30 0v42c10-6 20-6 30 0V30Z"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linejoin="round"
      />
      <path d="M42 30v42" stroke="currentColor" stroke-width="1.4" />
      <path
        d="M52 46c4-4 9-5 14-3M52 54c4-4 9-5 14-3M30 46c-4-4-9-5-14-3"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linecap="round"
        opacity="0.7"
      />
    </svg>

    <div class="empty-copy">
      <p class="empty-title">{{ title }}</p>
      <p v-if="description" class="empty-desc">{{ description }}</p>
    </div>

    <div class="empty-actions">
      <slot name="actions">
        <BaseButton v-if="actionText" variant="primary" size="md" @click="handleAction">
          {{ actionText }}
        </BaseButton>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-12) var(--space-6);
  text-align: center;
}

.empty-state.is-compact {
  padding: var(--space-8) var(--space-4);
}

.empty-image {
  width: 100%;
  max-width: 280px;
  height: auto;
  border-radius: var(--radius-lg);
}

.empty-illustration {
  width: 96px;
  height: 96px;
  color: var(--color-muted-2);
}

.empty-copy {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.empty-title {
  color: var(--color-ink-2);
  font-size: 16px;
  font-weight: 500;
  line-height: 26px;
}

.empty-desc {
  max-width: 40ch;
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.empty-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-1);
}

.empty-actions:empty {
  display: none;
}
</style>
