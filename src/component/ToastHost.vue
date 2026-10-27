<script setup>
/**
 * 全局 Toast 容器
 *
 * 用途：右上角堆叠展示轻提示，最多 3 条，3 秒自动消失，悬停暂停
 * 用法：在 AppLayout 中挂载一次；业务侧通过 useToast() 触发
 *       const toast = useToast(); toast.success('已添加 apple')
 */
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-vue-next'
import { useToastStore } from '../stores/model/toast'

const toastStore = useToastStore()

const iconMap = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-host" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast" tag="div" class="toast-stack">
        <div
          v-for="item in toastStore.items"
          :key="item.id"
          class="toast"
          :class="`is-${item.type}`"
          :role="item.type === 'error' ? 'alert' : 'status'"
          @mouseenter="toastStore.pause(item.id)"
          @mouseleave="toastStore.resume(item.id)"
        >
          <component
            :is="iconMap[item.type]"
            class="toast-icon"
            :size="18"
            :stroke-width="1.8"
            aria-hidden="true"
          />
          <p class="toast-message">{{ item.message }}</p>
          <button
            type="button"
            class="toast-close"
            aria-label="关闭提示"
            @click="toastStore.remove(item.id)"
          >
            <X :size="14" :stroke-width="2" aria-hidden="true" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: var(--space-6);
  right: var(--space-6);
  z-index: var(--z-toast);
  width: min(360px, calc(100vw - var(--space-8)));
  pointer-events: none;
}

.toast-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  pointer-events: auto;
}

.toast-icon {
  flex: 0 0 auto;
  margin-top: 1px;
}

.is-success .toast-icon {
  color: var(--color-success);
}

.is-error .toast-icon {
  color: var(--color-danger);
}

.is-info .toast-icon {
  color: var(--color-info);
}

.toast-message {
  flex: 1;
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  overflow-wrap: anywhere;
}

.toast-close {
  display: grid;
  flex: 0 0 22px;
  place-items: center;
  width: 22px;
  height: 22px;
  margin: -2px -4px 0 0;
  border-radius: var(--radius-sm);
  color: var(--color-muted-2);
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.toast-close:hover {
  background: var(--color-bg-deep);
  color: var(--color-ink-2);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 220ms var(--ease-out),
    transform 220ms var(--ease-out);
}

.toast-leave-active {
  transition-duration: 160ms;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 767px) {
  .toast-host {
    top: var(--space-3);
    right: var(--space-3);
    left: var(--space-3);
    width: auto;
  }
}
</style>
