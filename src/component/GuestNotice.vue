<script setup>
/**
 * 游客登录提示条
 *
 * 用途：放在遮罩列表 / 统计卡上方，说明「为什么内容被遮住、登录后有什么」。
 * 用法：<GuestNotice title="登录后查看你的单词" @login="goLogin('/words')" />
 *
 * props:
 *   title       — 主文案，如「登录后查看你的单词」
 *   description — 补充说明，默认「登录后会自动回到这一页」
 *   actionText  — 按钮文字，默认「去登录」
 *   compact     — 窄版，用于个人中心替换设置卡的位置
 * emits:
 *   login — 点击登录按钮；组件不依赖路由，由页面决定回跳地址
 */
import { LogIn } from 'lucide-vue-next'
import BaseButton from './BaseButton.vue'

defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '登录后会自动回到这一页' },
  actionText: { type: String, default: '去登录' },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['login'])
</script>

<template>
  <div class="guest-notice" :class="{ 'is-compact': compact }">
    <span class="notice-icon" aria-hidden="true">
      <LogIn :size="20" :stroke-width="1.8" />
    </span>
    <div class="notice-copy">
      <p class="notice-title">{{ title }}</p>
      <p class="notice-desc">{{ description }}</p>
    </div>
    <BaseButton variant="secondary" size="sm" @click="emit('login')">{{ actionText }}</BaseButton>
  </div>
</template>

<style scoped>
.guest-notice {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border: 1px dashed var(--color-line-strong);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.guest-notice.is-compact {
  align-items: flex-start;
  flex-direction: column;
}

.notice-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-bg-deep);
  color: var(--color-accent);
}

.notice-copy {
  flex: 1;
  min-width: 0;
}

.notice-title {
  color: var(--color-ink);
  font-size: var(--text-body);
  line-height: var(--leading-body);
}

.notice-desc {
  margin-top: 2px;
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.guest-notice :deep(.base-button) {
  flex-shrink: 0;
  min-height: 44px;
}

@media (max-width: 767px) {
  .guest-notice {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .guest-notice :deep(.base-button) {
    width: 100%;
  }
}
</style>
