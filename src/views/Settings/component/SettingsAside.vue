<script setup>
/**
 * 设置页装饰栏
 *
 * 用途：浅米色 sticky 面板，居中衬线引语 + 底部山形内联线稿；小于 1100px 由页面隐藏
 * 用法：<SettingsAside />
 */
</script>

<template>
  <aside class="settings-aside">
    <p class="aside-quote">The best way to predict your future is to create it.</p>

    <svg
      class="aside-illustration"
      viewBox="0 0 280 140"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="214" cy="34" r="12" stroke="currentColor" stroke-width="1.2" />
      <path
        d="M4 132 74 58l30 34 46-52 46 56 30-30 50 66"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linejoin="round"
      />
      <path d="M4 132h272" stroke="currentColor" stroke-width="1.2" opacity="0.6" />
    </svg>
  </aside>
</template>

<style scoped>
.settings-aside {
  position: sticky;
  top: var(--space-6);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 440px;
  padding: var(--space-8) var(--space-6);
  border-radius: var(--radius-xl);
  background: var(--color-bg-deep);
}

.aside-quote {
  max-width: 18ch;
  margin: auto;
  color: var(--color-ink-2);
  font-family: var(--font-display);
  font-size: 20px;
  font-style: italic;
  line-height: 32px;
  text-align: center;
}

.aside-illustration {
  width: 100%;
  height: auto;
  color: var(--color-line-strong);
}
</style>
