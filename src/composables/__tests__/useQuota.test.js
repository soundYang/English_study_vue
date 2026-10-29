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
import { fetchApiKey } from '../../api/profile'

vi.mock('../../api/quota', () => ({ fetchQuota: vi.fn() }))
vi.mock('../../api/profile', () => ({ fetchApiKey: vi.fn() }))

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
  // 默认没有自备 Key：额度口径与原有用例一致
  fetchApiKey.mockResolvedValue({ enabled: true, supportedProviders: ['deepseek'], key: null })
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

  // 有自备 Key 花的是用户自己的钱：免费额度到 0 也不拦（md/43 §12）
  it('should let an own-key user generate when the free quota is exhausted', async () => {
    fetchApiKey.mockResolvedValue({
      enabled: true,
      supportedProviders: ['deepseek'],
      key: { provider: 'deepseek', maskedKey: 'sk-****9f3a', status: 'active' },
    })
    fetchQuota.mockResolvedValue({
      ...ALLOWED,
      primary: { scope: 'device', limit: 3, used: 3, remaining: 0 },
      blocking: { scope: 'device', limit: 3, used: 3, remaining: 0 },
    })

    mountQuota()
    await flushPromises()

    expect(state.usingOwnKey.value).toBe(true)
    expect(state.isBlocked.value).toBe(false)
    expect(state.canGenerate.value).toBe(true)
    // 额度数字仍是免费额度口径，文案改成「使用我的 API Key」，不说「今天不能生成」
    expect(state.remaining.value).toBe(0)
    expect(state.quotaNote.value).toBe('使用我的 API Key，不占用免费次数')
  })

  // 服务端关闭功能时存量 Key 不生效，仍按免费额度拦人
  it('should ignore a stored key when the feature is disabled', async () => {
    fetchApiKey.mockResolvedValue({
      enabled: false,
      supportedProviders: ['deepseek'],
      key: { provider: 'deepseek', maskedKey: 'sk-****9f3a', status: 'active' },
    })
    fetchQuota.mockResolvedValue({
      ...ALLOWED,
      primary: { scope: 'device', limit: 3, used: 3, remaining: 0 },
    })

    mountQuota()
    await flushPromises()

    expect(state.usingOwnKey.value).toBe(false)
    expect(state.isBlocked.value).toBe(true)
    expect(state.canGenerate.value).toBe(false)
  })

  // Key 查询失败不能把入口锁死：按没有 Key 处理，额度查询照常决定
  it('should fail open to the free quota when the key request fails', async () => {
    fetchApiKey.mockRejectedValue(new Error('读取失败'))
    fetchQuota.mockResolvedValue(ALLOWED)

    mountQuota()
    await flushPromises()

    expect(state.usingOwnKey.value).toBe(false)
    expect(state.canGenerate.value).toBe(true)
    expect(state.quotaNote.value).toBe('今日剩余 2 次')
  })
})
