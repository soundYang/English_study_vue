<script setup>
/**
 * 404 视图
 * 地址无效时提供返回首页与查看历史两个出口。
 */
import { BookOpen } from 'lucide-vue-next'
</script>

<template>
  <section class="not-found">
    <span class="not-found-icon" aria-hidden="true">
      <BookOpen :size="28" :stroke-width="1.4" />
    </span>
    <p class="not-found-code">404</p>
    <h1 class="not-found-title">这页好像不在书里</h1>
    <p class="not-found-desc">地址可能有误，或者内容已被移动。</p>
    <div class="not-found-actions">
      <RouterLink class="action action-primary" to="/">返回首页</RouterLink>
      <RouterLink class="action action-ghost" to="/history">查看历史</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
}

.not-found-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-bg-deep);
  color: var(--color-primary);
}

.not-found-code {
  margin-top: var(--space-5);
  color: var(--color-muted);
  font-family: var(--font-display);
  font-size: var(--text-caption);
  letter-spacing: 0.28em;
}

.not-found-title {
  margin-top: var(--space-2);
  font-family: var(--font-display);
  font-size: var(--text-page-title);
  line-height: var(--leading-page-title);
  letter-spacing: 0.02em;
}

.not-found-desc {
  margin-top: var(--space-2);
  color: var(--color-muted);
  font-size: var(--text-body);
}

.not-found-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-8);
}

.action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
  height: 40px;
  padding: 0 var(--space-5);
  border-radius: var(--radius-sm);
  font-size: 14px;
  transition:
    background-color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}

.action-primary {
  background: var(--color-primary);
  color: var(--color-primary-ink);
}

.action-primary:hover {
  background: var(--color-primary-hover);
}

.action-ghost {
  border: 1px solid var(--color-line-strong);
  color: var(--color-ink-2);
}

.action-ghost:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

@media (max-width: 479px) {
  .not-found-actions {
    flex-direction: column;
    width: 100%;
  }

  .action {
    width: 100%;
  }
}
</style>
