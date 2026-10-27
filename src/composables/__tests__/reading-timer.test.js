/**
 * 阅读计时器测试
 * 覆盖按截止时间倒计时、最后一分钟提示、归零回调与不自动交卷。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useReadingTimer } from '../useReadingTimer'

let api = null
let onTick = null
let onFinish = null

const Host = defineComponent({
  setup() {
    api = useReadingTimer({ initialSeconds: 0, onTick, onFinish })
    return () => h('span', String(api.remaining.value))
  },
})

function mountTimer() {
  return mount(Host)
}

beforeEach(() => {
  vi.useFakeTimers()
  onTick = vi.fn()
  onFinish = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useReadingTimer', () => {
  it('should count down from the deadline and report each second', () => {
    const wrapper = mountTimer()
    api.start(3)

    vi.advanceTimersByTime(1000)
    expect(api.remaining.value).toBe(2)
    expect(onTick).toHaveBeenLastCalledWith(2)

    vi.advanceTimersByTime(1000)
    expect(api.remaining.value).toBe(1)
    expect(api.isUrgent.value).toBe(true)

    wrapper.unmount()
  })

  it('should stop at zero and call onFinish once without submitting', () => {
    const wrapper = mountTimer()
    api.start(2)

    vi.advanceTimersByTime(1000)
    vi.advanceTimersByTime(1000)

    expect(api.remaining.value).toBe(0)
    expect(api.isRunning.value).toBe(false)
    expect(api.isFinished.value).toBe(true)
    expect(onFinish).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(5000)
    expect(onFinish).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('should clear the interval on unmount', () => {
    const wrapper = mountTimer()
    api.start(5)

    wrapper.unmount()
    vi.advanceTimersByTime(3000)

    expect(onTick).not.toHaveBeenCalled()
    expect(onFinish).not.toHaveBeenCalled()
  })
})
