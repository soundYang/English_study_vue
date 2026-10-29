<script setup>
/**
 * 游客整页占位
 *
 * 用途：阅读正文、练习结果这类「没有数据就没什么可看」的页面，游客态整体展示登录引导。
 * 用法：<GuestGate title="请登录后查看这篇阅读" @login="goLogin(route.fullPath)" />
 *
 * props:
 *   title       — 主标题，默认「请登录后查看」
 *   description — 说明，默认「登录后会自动回到这一页。」
 *   loginText   — 登录按钮文字，默认「登录 / 注册」
 * emits:
 *   login — 点击登录按钮
 */
import { Lock } from 'lucide-vue-next'
import BaseButton from './BaseButton.vue'

defineProps({
  title: { type: String, default: '请登录后查看' },
  description: { type: String, default: '登录后会自动回到这一页。' },
  loginText: { type: String, default: '登录 / 注册' },
})

const emit = defineEmits(['login'])
</script>

<template>
  <section class="guest-gate" aria-labelledby="guest-gate-title">
    <span class="gate-icon" aria-hidden="true">
      <Lock :size="26" :stroke-width="1.7" />
    </span>
    <h1 id="guest-gate-title" class="gate-title">{{ title }}</h1>
    <p class="gate-desc">{{ description }}</p>
    <div class="gate-actions">
      <BaseButton @click="emit('login')">{{ loginText }}</BaseButton>
      <RouterLink to="/" class="gate-home">返回首页</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.guest-gate {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  min-height: calc(100dvh - var(--topbar-height) - 2 * var(--content-pad-y));
  padding: var(--content-pad-y) var(--content-pad-x);
  text-align: center;
}

.gate-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin-bottom: var(--space-5);
  border-radius: 50%;
  background: var(--color-bg-deep);
  color: var(--color-accent);
}

.gate-title {
  font-family: var(--font-display);
  font-size: var(--text-section);
  line-height: var(--leading-section);
  letter-spacing: 0.02em;
}

.gate-desc {
  max-width: 36ch;
  margin-top: var(--space-3);
  color: var(--color-muted);
  font-size: var(--text-body);
  line-height: var(--leading-body);
}

.gate-actions {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-top: var(--space-6);
}

.gate-actions :deep(.base-button),
.gate-home {
  min-height: 44px;
}

.gate-home {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--space-2);
  color: var(--color-muted);
  font-size: var(--text-small);
  text-decoration: underline;
  text-underline-offset: 4px;
}

.gate-home:hover {
  color: var(--color-ink);
}

@media (max-width: 767px) {
  .gate-actions {
    flex-direction: column;
    width: 100%;
  }

  .gate-actions :deep(.base-button) {
    width: 100%;
  }
}
</style>
