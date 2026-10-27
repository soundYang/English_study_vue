/**
 * 数字滚动组合式函数
 * 在 duration 毫秒内用 easeOutCubic 从当前值过渡到目标值，供结果页分数与成绩环同步使用。
 * 用法：const { value, start, stop } = useCountUp({ duration: 900 })
 *       start(80)
 *
 * - duration <= 0 或系统开启“减少动效”时直接写入终值；
 * - 重复 start 会从当前值继续动画，不会跳回 0；
 * - 在组件内使用时随组件卸载自动取消动画帧。
 */
import { getCurrentInstance, onBeforeUnmount, ref } from 'vue'

const DEFAULT_DURATION = 900

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function now() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

export function useCountUp(options = {}) {
  const rawDuration = Number(options.duration)
  const duration = Number.isFinite(rawDuration) ? Math.max(0, rawDuration) : DEFAULT_DURATION

  const value = ref(0)

  let from = 0
  let target = 0
  let startedAt = 0
  let frame = null
  let timer = null

  function cancelScheduled() {
    if (frame !== null) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
      frame = null
    }
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function schedule(callback) {
    if (typeof requestAnimationFrame === 'function') {
      frame = requestAnimationFrame(callback)
      return
    }
    timer = setTimeout(() => callback(now()), 16)
  }

  function finish() {
    value.value = target
    frame = null
    timer = null
  }

  function tick(stamp) {
    const elapsed = Math.max(0, stamp - startedAt)
    const progress = duration === 0 ? 1 : Math.min(1, elapsed / duration)
    const eased = 1 - Math.pow(1 - progress, 3)

    value.value = Math.round(from + (target - from) * eased)

    if (progress < 1) {
      schedule(tick)
      return
    }

    finish()
  }

  /** 从当前值动画到新的目标值；负数按 0 处理 */
  function start(nextTarget) {
    const safeTarget = Math.max(0, Number(nextTarget) || 0)

    cancelScheduled()
    target = safeTarget

    if (duration === 0 || prefersReducedMotion()) {
      value.value = safeTarget
      return
    }

    from = value.value
    startedAt = now()
    schedule(tick)
  }

  /** 停止动画并保留当前值 */
  function stop() {
    cancelScheduled()
  }

  if (getCurrentInstance()) onBeforeUnmount(stop)

  return { value, start, stop }
}
