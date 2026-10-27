/**
 * 题目滚动监听
 * 使用 IntersectionObserver 触发，但按元素与视口顶部的实际位置选出当前题，
 * 因而文章区滚动与题目面板内部滚动都能正确更新进度。
 *
 * 用法：const { activeId, observe, disconnect } = useScrollSpy()
 *       observe(questionPanelRef.value)
 */
import { onBeforeUnmount, ref } from 'vue'

const DEFAULT_OFFSET = 96

export function useScrollSpy({ offset = DEFAULT_OFFSET, attribute = 'data-question-id' } = {}) {
  const activeId = ref('')

  let observer = null
  let elements = []
  let raf = 0

  function schedule() {
    if (raf) return
    if (typeof requestAnimationFrame === 'function') {
      raf = requestAnimationFrame(compute)
    } else {
      raf = setTimeout(compute, 16)
    }
  }

  function compute() {
    raf = 0
    if (!elements.length) return

    let current = null

    for (const element of elements) {
      // 移动端只显示一个面板，隐藏的题目不参与计算
      if (!element.getClientRects().length) continue
      if (element.getBoundingClientRect().top <= offset) current = element
    }

    if (!current)
      current = elements.find((element) => element.getClientRects().length) || elements[0]

    const id = current?.getAttribute(attribute)
    if (id) activeId.value = id
  }

  function disconnect() {
    observer?.disconnect()
    observer = null
    elements = []

    if (raf) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf)
      else clearTimeout(raf)
      raf = 0
    }
  }

  function observe(container) {
    disconnect()
    if (!container) return

    elements = Array.from(container.querySelectorAll(`[${attribute}]`))
    if (!elements.length) return

    const firstId = elements[0].getAttribute(attribute)
    if (firstId) activeId.value = firstId

    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(schedule, {
        root: null,
        rootMargin: `-${offset}px 0px -55% 0px`,
        threshold: [0, 1],
      })
      elements.forEach((element) => observer.observe(element))
    }

    compute()
  }

  onBeforeUnmount(disconnect)

  return { activeId, observe, disconnect, refresh: schedule }
}
