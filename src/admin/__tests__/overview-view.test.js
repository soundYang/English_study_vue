/**
 * 管理端概览：自备 API Key 指标卡
 *
 * 卡片只在真的有人接入时出现；出现时主数字是在用人数，
 * 副信息里的失效数量提醒管理员「接入过但上游拒绝」。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Overview from '../views/Overview.vue'

const api = vi.hoisted(() => ({ fetchAdminOverview: vi.fn() }))

vi.mock('../api/overview', () => ({ fetchAdminOverview: api.fetchAdminOverview }))

let wrapper = null

function overviewData(apiKeys) {
  return {
    users: { total: 10, activeToday: 2 },
    readings: { today: 3, total: 20 },
    tokens: {
      freeBudget: { enabled: true, usedTokens: 100, limitTokens: 1000, exhausted: false },
    },
    feedback: { open: 1, replied: 2, closed: 3 },
    apiKeys,
  }
}

async function mountOverview() {
  wrapper = mount(Overview)
  await flushPromises()
  return wrapper
}

function apiKeyCard() {
  return wrapper.findAll('.stat-card').find((card) => card.text().includes('自备 API Key'))
}

beforeEach(() => {
  api.fetchAdminOverview.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('admin overview api key card', () => {
  it('should hide the card when nobody has connected a key', async () => {
    api.fetchAdminOverview.mockResolvedValue(overviewData({ total: 0, active: 0, invalid: 0 }))

    await mountOverview()

    expect(apiKeyCard()).toBeUndefined()
  })

  it('should show the active count and call out invalid keys', async () => {
    api.fetchAdminOverview.mockResolvedValue(overviewData({ total: 3, active: 2, invalid: 1 }))

    await mountOverview()

    const card = apiKeyCard()
    expect(card).toBeDefined()
    expect(card.find('.stat-value').text()).toBe('2')
    expect(card.find('.stat-hint').text()).toContain('共 3 人接入')
    expect(card.find('.stat-hint').text()).toContain('1 个已失效')
  })

  it('should omit the invalid count when every key is active', async () => {
    api.fetchAdminOverview.mockResolvedValue(overviewData({ total: 2, active: 2, invalid: 0 }))

    await mountOverview()

    expect(apiKeyCard().find('.stat-hint').text()).not.toContain('已失效')
  })
})
