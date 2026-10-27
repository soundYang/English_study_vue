/**
 * Toast 状态
 * 全局轻提示队列：最多同时展示 3 条，默认 3 秒自动消失，支持悬停暂停。
 * 计时器保存在 store 内部，避免组件卸载后仍有定时器回收已消失的提示。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

const MAX_VISIBLE = 3
const DEFAULT_DURATION = 3000

export const useToastStore = defineStore('toast', () => {
  const items = ref([])
  const timers = new Map()
  let nextId = 1

  function clearTimer(id) {
    const timer = timers.get(id)
    if (!timer) return
    if (timer.timeoutId) clearTimeout(timer.timeoutId)
    timers.delete(id)
  }

  function remove(id) {
    clearTimer(id)
    items.value = items.value.filter((item) => item.id !== id)
  }

  function schedule(item, remaining) {
    const duration = remaining ?? item.duration
    const timeoutId = setTimeout(() => remove(item.id), duration)
    timers.set(item.id, { timeoutId, startedAt: Date.now(), remaining: duration })
  }

  /**
   * 推入一条提示
   * @param {{ type?: 'success' | 'error' | 'info', message: string, duration?: number }} payload
   * @returns {number | null} 提示 id，空消息返回 null
   */
  function push({ type = 'info', message, duration = DEFAULT_DURATION } = {}) {
    if (!message) return null
    const item = { id: nextId, type, message, duration }
    nextId += 1
    items.value = [...items.value, item].slice(-MAX_VISIBLE)

    // 超出上限被挤掉的提示需要同步清掉计时器，防止内存中残留
    const visibleIds = new Set(items.value.map((toast) => toast.id))
    timers.forEach((_, id) => {
      if (!visibleIds.has(id)) clearTimer(id)
    })

    schedule(item)
    return item.id
  }

  /** 悬停时暂停倒计时，保留剩余时间 */
  function pause(id) {
    const timer = timers.get(id)
    if (!timer || !timer.timeoutId) return
    clearTimeout(timer.timeoutId)
    const elapsed = Date.now() - timer.startedAt
    timers.set(id, {
      timeoutId: null,
      startedAt: 0,
      remaining: Math.max(0, timer.remaining - elapsed),
    })
  }

  /** 移出后继续倒计时 */
  function resume(id) {
    const timer = timers.get(id)
    if (!timer || timer.timeoutId) return
    const item = items.value.find((toast) => toast.id === id)
    if (!item) return
    schedule(item, timer.remaining)
  }

  function clear() {
    items.value.forEach((item) => clearTimer(item.id))
    items.value = []
  }

  return { items, push, remove, pause, resume, clear }
})
