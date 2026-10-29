<script setup>
/**
 * 复制按钮
 *
 * 用途：日志里的 requestId 需要原样贴给报错用户，点一下复制并短暂回显「已复制」。
 * 用法：<CopyButton :value="row.requestId" label="请求 ID" />
 *
 * props:
 *   value — 要复制的文本，空值不渲染按钮
 *   label — 用于无障碍名称（「复制请求 ID」），也用于 title
 */
import { onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  value: { type: String, default: '' },
  label: { type: String, default: '内容' },
})

const copied = ref(false)
let timer = null

async function copy() {
  if (!props.value) return

  try {
    await navigator.clipboard.writeText(String(props.value))
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    // 非安全上下文 / 用户拒绝授权时不让按钮卡在「已复制」
    copied.value = false
  }
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <button
    v-if="value"
    type="button"
    class="copy-button"
    :class="{ 'is-copied': copied }"
    :aria-label="`复制${label}`"
    :title="`复制${label}`"
    @click.stop="copy"
  >
    {{ copied ? '已复制' : '复制' }}
  </button>
</template>

<style scoped>
.copy-button {
  flex: 0 0 auto;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  text-decoration: underline;
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease-out);
}

.copy-button:hover {
  color: var(--color-ink-2);
}

.copy-button.is-copied {
  color: var(--color-success);
  text-decoration: none;
}

.copy-button:focus-visible {
  outline: none;
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 2px var(--focus-ring);
}
</style>
