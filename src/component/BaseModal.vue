<script setup>
/**
 * 基础弹窗
 *
 * 用途：带遮罩、Esc 关闭、焦点陷阱与背景滚动锁定的对话框容器
 * 用法：<BaseModal v-model:open="open" title="编辑单词">
 *         <p>正文</p>
 *         <template #footer><BaseButton @click="save">保存</BaseButton></template>
 *       </BaseModal>
 *
 * props:
 *   open            — 是否打开（配合 v-model:open）
 *   title           — 标题，同时作为 aria-labelledby
 *   description     — 标题下方说明
 *   maxWidth        — 最大宽度，数字按 px 处理，默认 480
 *   closeOnBackdrop — 点击遮罩是否关闭，默认 true
 *   showClose       — 是否显示右上角关闭按钮，默认 true
 *   sheetOnMobile   — 小于 768px 时从底部弹出，默认 false
 * emits:
 *   update:open / close
 * slots:
 *   default — 正文；footer — 底部操作区
 */
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  maxWidth: { type: [Number, String], default: 480 },
  closeOnBackdrop: { type: Boolean, default: true },
  showClose: { type: Boolean, default: true },
  sheetOnMobile: { type: Boolean, default: false },
})

const emit = defineEmits(['update:open', 'close'])

const dialogRef = ref(null)
const uid = useId()
const titleId = `modal-title-${uid}`
const descriptionId = `modal-desc-${uid}`

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

let lastActiveElement = null
let isLocked = false

const dialogStyle = {
  maxWidth: typeof props.maxWidth === 'number' ? `${props.maxWidth}px` : props.maxWidth,
}

// 同一页面可能先后打开多个弹窗，用计数保证最后一个关闭时才恢复滚动
let lockCount = 0

function lockScroll() {
  if (isLocked) return
  isLocked = true
  lockCount += 1
  document.body.classList.add('has-modal-open')
}

function unlockScroll() {
  if (!isLocked) return
  isLocked = false
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) document.body.classList.remove('has-modal-open')
}

function getFocusable() {
  if (!dialogRef.value) return []
  return Array.from(dialogRef.value.querySelectorAll(FOCUSABLE_SELECTOR))
}

function close() {
  emit('update:open', false)
  emit('close')
}

function handleBackdrop() {
  if (props.closeOnBackdrop) close()
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    close()
    return
  }

  if (event.key !== 'Tab') return

  const focusable = getFocusable()
  if (!focusable.length) {
    event.preventDefault()
    dialogRef.value?.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  const isOutside = !dialogRef.value?.contains(active)

  if (event.shiftKey && (active === first || isOutside)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || isOutside)) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      lastActiveElement = document.activeElement
      lockScroll()
      await nextTick()
      const focusable = getFocusable()
      if (focusable.length) focusable[0].focus()
      else dialogRef.value?.focus()
    } else {
      unlockScroll()
      if (lastActiveElement instanceof HTMLElement) lastActiveElement.focus()
      lastActiveElement = null
    }
  },
  { immediate: true },
)

onBeforeUnmount(unlockScroll)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="modal-root"
        :class="{ 'is-sheet': sheetOnMobile }"
        @mousedown.self="handleBackdrop"
      >
        <div
          ref="dialogRef"
          class="modal-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? titleId : undefined"
          :aria-describedby="description ? descriptionId : undefined"
          tabindex="-1"
          :style="dialogStyle"
          @keydown="handleKeydown"
        >
          <header class="modal-header">
            <div class="modal-heading">
              <h2 v-if="title" :id="titleId" class="modal-title">{{ title }}</h2>
              <p v-if="description" :id="descriptionId" class="modal-desc">{{ description }}</p>
            </div>
            <button
              v-if="showClose"
              type="button"
              class="modal-close"
              aria-label="关闭对话框"
              @click="close"
            >
              <X :size="18" :stroke-width="1.8" aria-hidden="true" />
            </button>
          </header>

          <div v-if="$slots.default" class="modal-body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-root {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  background: rgba(30, 42, 36, 0.32);
  backdrop-filter: blur(2px);
}

.modal-dialog {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 90dvh;
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  outline: none;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-6) var(--space-6) 0;
}

.modal-title {
  font-family: var(--font-display);
  font-size: var(--text-section);
  line-height: var(--leading-section);
  letter-spacing: 0.02em;
}

.modal-desc {
  margin-top: var(--space-2);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.modal-close {
  display: grid;
  flex: 0 0 32px;
  place-items: center;
  width: 32px;
  height: 32px;
  margin: -4px -4px 0 0;
  border-radius: var(--radius-sm);
  color: var(--color-muted);
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.modal-close:hover {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.modal-body {
  padding: var(--space-5) var(--space-6);
  overflow-y: auto;
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-body);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: 0 var(--space-6) var(--space-6);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--dur-base) var(--ease-out);
}

.modal-leave-active {
  transition-duration: 140ms;
  transition-timing-function: var(--ease-in-out);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-dialog {
  transition: transform var(--dur-base) var(--ease-out);
}

.modal-leave-active .modal-dialog {
  transition: transform 140ms var(--ease-in-out);
}

.modal-enter-from .modal-dialog {
  transform: scale(0.97);
}

.modal-leave-to .modal-dialog {
  transform: scale(0.98);
}

@media (max-width: 767px) {
  .modal-root {
    padding: var(--space-4);
  }

  .modal-root.is-sheet {
    align-items: flex-end;
    padding: 0;
  }

  .modal-root.is-sheet .modal-dialog {
    max-width: 100% !important;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }

  .modal-root.is-sheet .modal-body {
    padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
  }

  .modal-root.is-sheet.modal-enter-from .modal-dialog {
    transform: translateY(16px);
  }

  .modal-header {
    padding: var(--space-5) var(--space-5) 0;
  }

  .modal-body {
    padding: var(--space-4) var(--space-5);
  }

  .modal-footer {
    padding: 0 var(--space-5) var(--space-5);
  }
}
</style>
