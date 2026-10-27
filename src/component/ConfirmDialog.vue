<script setup>
/**
 * 二次确认对话框
 *
 * 用途：删除、退出等需要二次确认的操作；默认焦点落在“取消”上
 * 用法：<ConfirmDialog
 *         v-model:open="open"
 *         title="删除 “apple”？"
 *         description="历史阅读中的词汇快照不会受影响。"
 *         danger
 *         confirm-text="删除"
 *         @confirm="remove"
 *       />
 *
 * props:
 *   open / title / description — 同 BaseModal
 *   confirmText / cancelText   — 按钮文案
 *   danger                     — 确认按钮使用危险样式
 *   loading                    — 确认处理中，两个按钮均禁用
 * emits:
 *   update:open / confirm / cancel
 */
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  confirmText: { type: String, default: '确认' },
  cancelText: { type: String, default: '取消' },
  danger: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['update:open', 'confirm', 'cancel'])

function cancel() {
  if (props.loading) return
  emit('update:open', false)
  emit('cancel')
}

function confirm() {
  if (props.loading) return
  emit('confirm')
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="title"
    :description="description"
    :max-width="440"
    :close-on-backdrop="!loading"
    :close-on-esc="!loading"
    :show-close="false"
    @update:open="emit('update:open', $event)"
    @close="cancel"
  >
    <slot />
    <template #footer>
      <BaseButton variant="secondary" :disabled="loading" @click="cancel">
        {{ cancelText }}
      </BaseButton>
      <BaseButton :variant="danger ? 'danger' : 'primary'" :loading="loading" @click="confirm">
        {{ confirmText }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
