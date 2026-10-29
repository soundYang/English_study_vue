<script setup>
/**
 * 词卡操作菜单
 *
 * 用途：一张卡上的标记动作——标为认识 / 标为不认识 / 取消标记；只读词不渲染（actions 为 null）
 * 用法：<WordCardMenu :item="item" :pending="pending" @select="type => ..." />
 *
 * 行为：
 *   - 点击外部关闭；Esc 关闭并把焦点还给触发按钮；上下方向键在菜单项间移动
 *   - pending 时触发器 aria-disabled 而不是 disabled，避免焦点丢失
 *   - 已在个人词库里的词也能展开，里面是一条禁用项说明原因，比凭空没有菜单清楚
 *
 * props:
 *   item    — 词表项；用 menuActionsOf 决定菜单内容
 *   pending — 该词的写请求进行中
 * emits:
 *   select — 选中某一项，携带 type（known / unknown / none）
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { MoreVertical } from 'lucide-vue-next'
import { menuActionsOf } from '../../../unit/basic-words'

const props = defineProps({
  item: { type: Object, required: true },
  pending: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

const rootRef = ref(null)
const triggerRef = ref(null)
const isOpen = ref(false)

const actions = computed(() => menuActionsOf(props.item))

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

function choose(action) {
  if (props.pending || action.type === 'locked') return

  close()
  triggerRef.value?.focus()
  emit('select', action.type)
}

function handleKeydown(event) {
  if (!isOpen.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    triggerRef.value?.focus()
    return
  }

  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return

  event.preventDefault()
  const nodes = Array.from(rootRef.value?.querySelectorAll('[role="menuitem"]') || [])
  if (nodes.length === 0) return

  const current = nodes.indexOf(document.activeElement)
  const step = event.key === 'ArrowDown' ? 1 : -1
  const next = (current + step + nodes.length) % nodes.length
  nodes[next].focus()
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
  <div v-if="actions" ref="rootRef" class="card-menu" @keydown="handleKeydown">
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
      <li v-for="action in actions" :key="action.type" role="none">
        <button
          type="button"
          role="menuitem"
          class="menu-item"
          :class="{ 'is-danger': action.type === 'unknown', 'is-locked': action.type === 'locked' }"
          :disabled="pending || action.type === 'locked'"
          @click="choose(action)"
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
