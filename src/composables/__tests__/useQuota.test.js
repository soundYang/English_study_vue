/**
 * useQuota 测试
 * 锁住三件事：remaining / blocking → 能否生成；blocking 优先于 primary 的余量；
 * 接口失败时 fail-open（额度未知不挡人）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useQuota } from '../useQuota'
import { fetchQuota } from '../../api/quota'

vi.mock('../../api/quota', () => ({ fetchQuota: vi.fn() }))

const ALLOWED = {
  day: '2026-10-29',
  resetAt: '2026-10-29T16:00:00.000Z',
  primary: { scope: 'device', limit: 3, used: 1, remaining: 2 },
  blocking: null,
  breakdown: [],
}

let state = null

function mountQuota() {
  const Host = defineComponent({
    setup() {
      state = useQuota()
      return () => null
    },
  })

  return mount(Host)
}

beforeEach(() => {
  state = null
  vi.clearAllMocks()
})

describe('useQuota', () => {
  it('should expose the remaining count when generating is allowed', async () => {
    fetchQuota.mockResolvedValue(ALLOWED)
    mountQuota()
    await flushPromises()

    expect(state.remaining.value).toBe(2)
    expect(state.isBlocked.value).toBe(false)
    expect(state.canGenerate.value).toBe(true)
    expect(state.quotaNote.value).toBe('今日剩余 2 次')
  })

  it('should block when any dimension is used up even if the primary has room', async () => {
    fetchQuota.mockResolvedValue({
      ...ALLOWED,
      blocking: { scope: 'network', limit: 10, used: 10, remaining: 0 },
    })
    mountQuota()
    await flushPromises()

    expect(state.isBlocked.value).toBe(true)
    expect(state.canGenerate.value).toBe(false)
    expect(state.blockedHint.value).toContain('网络每天最多生成 10 次')
    // resetAt 按北京时间展示，不跟本机时区走
    expect(state.blockedHint.value).toContain('10月30日 00:00')
    expect(state.quotaNote.value).toBe(state.blockedHint.value)
  })

  it('should block when the primary is at zero even without a blocking item', async () => {
    fetchQuota.mockResolvedValue({
      ...ALLOWED,
      primary: { scope: 'device', limit: 3, used: 3, remaining: 0 },
    })
    mountQuota()
    await flushPromises()

    expect(state.isBlocked.value).toBe(true)
    expect(state.canGenerate.value).toBe(false)
    expect(state.blockedHint.value).toContain('设备每天最多生成 3 次')
  })

  it('should fail open when the quota request fails', async () => {
    fetchQuota.mockRejectedValue(new Error('网络错误'))
    mountQuota()
    await flushPromises()

    expect(state.quota.value).toBeNull()
    expect(state.error.value).toBe('网络错误')
    expect(state.canGenerate.value).toBe(true)
    expect(state.quotaNote.value).toBe('')
  })
})
