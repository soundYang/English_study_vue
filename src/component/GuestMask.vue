<script setup>
/**
 * 游客态数据遮罩
 *
 * 用途：把私人数据替换成固定占位符，保持行高与列宽，不接收真实值。
 * 用法：<GuestMask /> / <GuestMask mode="number" width="48px" />
 *
 * props:
 *   mode  — 'text'（默认，显示 ••••）/ 'number'（显示 **）
 *   width — 自定义宽度；不传时按 mode 取预设宽度
 *
 * 说明：组件刻意不接收「真实文本」，避免误把私人数据渲染进 DOM（md/45 §4.1）。
 *       假内容对读屏隐藏，旁边补一段仅供读屏的说明。
 */
import { computed } from 'vue'

const props = defineProps({
  mode: {
    type: String,
    default: 'text',
    validator: (value) => ['text', 'number'].includes(value),
  },
  width: { type: String, default: '' },
})

const resolvedWidth = computed(() => props.width || (props.mode === 'number' ? '2.5em' : '4em'))
</script>

<template>
  <span
    class="guest-mask"
    :class="`is-${mode}`"
    :style="{ width: resolvedWidth }"
    aria-hidden="true"
  >
    {{ mode === 'number' ? '**' : '••••' }}
  </span>
  <span class="sr-only">登录后查看</span>
</template>

<style scoped>
.guest-mask {
  display: inline-block;
  color: var(--color-muted);
  letter-spacing: 0.12em;
  line-height: inherit;
  text-align: center;
  user-select: none;
  vertical-align: baseline;
}

.guest-mask.is-number {
  letter-spacing: 0.18em;
}
</style>
