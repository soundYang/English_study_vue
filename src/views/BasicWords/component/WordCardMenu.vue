<script setup>
/**
 * 词卡操作菜单
 *
 * 用途：一张卡上的两种动作——标为不认识 / 恢复为基础词；只读词不渲染（action 为 null）
 * 用法：<WordCardMenu :item="item" :pending="pending" @remove="..." @restore="..." />
 *
 * 行为：
 *   - 点击外部关闭；Esc 关闭并把焦点还给触发按钮
 *   - pending 时触发器 aria-disabled 而不是 disabled，避免焦点丢失
 *   - 已在个人词库里的词也能展开，里面是一条禁用项说明原因，比凭空没有菜单清楚
 *
 * props:
 *   item    — 词表项；用 menuActionOf 决定菜单内容
 *   pending — 该词的写请求进行中
 * emits:
 *   remove / restore
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { MoreVertical } from 'lucide-vue-next'
import { menuActionOf } from '../../../unit/basic-words'

const props = defineProps({
  item: { type: Object, required: true },
  pending: { type: Boolean, default: false },
})

const emit = defineEmits(['remove', 'restore'])

const rootRef = ref(null)
const triggerRef = ref(null)
const isOpen = ref(false)

const action = computed(() => menuActionOf(props.item))
const isLocked = computed(() => action.value?.type === 'locked')

function toggle() {
  if (props.pending) return

  isOpen.value = !isOpen.value
  if (isOpen.value) {
    nextTick(() => rootRef.value?.querySelector('[role="menuitem"]')?.focus())
  }
}

function close() {
  isOpen.value = false
}

function choose() {
  if (props.pending || isLocked.value) return

  const type = action.value?.type
  close()
  triggerRef.value?.focus()

  if (type === 'remove') emit('remove', props.item)
  if (type === 'restore') emit('restore', props.item)
}

function handleKeydown(event) {
  if (event.key !== 'Escape' || !isOpen.value) return

  event.preventDefault()
  close()
  triggerRef.value?.focus()
}

function handleOutside(event) {
  if (!isOpen.value) return
  if (rootRef.value?.contains(event.target)) return

  close()
}

onMounted(() => document.addEventListener('pointerdown', handleOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleOutside))
</script>

<template>
  <div v-if="action" ref="rootRef" class="card-menu" @keydown="handleKeydown">
    <button
      ref="triggerRef"
      type="button"
      class="menu-trigger"
      :aria-label="`“${item.word}”的操作`"
      aria-haspopup="menu"
      :aria-expanded="isOpen ? 'true' : 'false'"
      :aria-disabled="pending ? 'true' : undefined"
      @click="toggle"
    >
      <MoreVertical :size="16" :stroke-width="1.8" aria-hidden="true" />
    </button>

    <ul v-if="isOpen" class="menu-list" role="menu">
      <li role="none">
        <button
          type="button"
          role="menuitem"
          class="menu-item"
          :class="{ 'is-danger': action.type === 'remove', 'is-locked': isLocked }"
          :disabled="pending || isLocked"
          @click="choose"
        >
          {{ action.label }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* z-index 1：卡片上铺满整卡的详情点击层是 0，菜单必须能点到 */
.card-menu {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
}

.menu-trigger {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  color: var(--color-muted);
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.menu-trigger:hover {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.menu-trigger[aria-disabled='true'] {
  cursor: progress;
  opacity: 0.5;
}

.menu-list {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: var(--z-topbar);
  min-width: 168px;
  margin: 0;
  padding: var(--space-1);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  list-style: none;
}

.menu-item {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border-radius: 6px;
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  text-align: left;
  white-space: nowrap;
}

.menu-item:hover:not(:disabled) {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.menu-item.is-danger {
  color: var(--color-danger, #b4453d);
}

.menu-item:disabled {
  cursor: default;
  color: var(--color-muted);
}

.menu-item.is-locked {
  white-space: normal;
}
</style>
