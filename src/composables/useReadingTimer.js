/**
 * 阅读建议用时倒计时
 * 基于截止时间计算剩余秒数，标签页被挂起后恢复也能得到正确值。
 * 归零只停止计时并触发 onFinish，不自动交卷。
 *
 * 用法：const timer = useReadingTimer({ initialSeconds: 900, onTick: save })
 *       timer.start()
 *       timer.remaining / timer.isUrgent / timer.isFinished
 */
import { computed, onBeforeUnmount, ref } from 'vue'

const URGENT_THRESHOLD = 60

function normalizeSeconds(value) {
  const safe = Math.floor(Number(value) || 0)
  return Math.max(0, safe)
}

export function useReadingTimer({ initialSeconds = 0, onTick, onFinish } = {}) {
  const remaining = ref(normalizeSeconds(initialSeconds))
  const isRunning = ref(false)

  let deadline = 0
  let timer = null

  const isUrgent = computed(() => remaining.value > 0 && remaining.value <= URGENT_THRESHOLD)
  const isFinished = computed(() => remaining.value <= 0)

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
    isRunning.value = false
  }

  function publish(value) {
    if (value === remaining.value) return
    remaining.value = value
    onTick?.(value)
  }

  function tick() {
    const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
    publish(next)

    if (next <= 0) {
      stop()
      onFinish?.()
    }
  }

  function start(seconds = remaining.value) {
    stop()
    const safe = normalizeSeconds(seconds)
    remaining.value = safe

    if (safe <= 0) {
      onFinish?.()
      return
    }

    deadline = Date.now() + safe * 1000
    isRunning.value = true
    timer = setInterval(tick, 1000)
  }

  onBeforeUnmount(stop)

  return {
    remaining,
    isRunning,
    isUrgent,
    isFinished,
    start,
    stop,
  }
}
