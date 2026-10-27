/**
 * useCountUp 测试
 * 覆盖零时长直出、负数归零、减少动效直出与停止后不再更新。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCountUp } from '../useCountUp'

const originalMatchMedia = window.matchMedia

afterEach(() => {
  window.matchMedia = originalMatchMedia
  vi.restoreAllMocks()
})

describe('useCountUp', () => {
  it('should jump to the target when duration is zero', () => {
    const { value, start } = useCountUp({ duration: 0 })

    start(80)

    expect(value.value).toBe(80)
  })

  it('should clamp a negative target to zero', () => {
    const { value, start } = useCountUp({ duration: 0 })

    start(-12)

    expect(value.value).toBe(0)
  })

  it('should show the final value when reduced motion is preferred', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    const { value, start } = useCountUp({ duration: 900 })

    start(80)

    expect(value.value).toBe(80)
  })

  it('should keep the current value after stop', async () => {
    const { value, start, stop } = useCountUp({ duration: 900 })

    start(80)
    stop()
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(value.value).toBe(0)
  })
})
