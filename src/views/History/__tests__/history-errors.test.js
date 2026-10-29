/**
 * 历史记录异常态测试
 * 通过 mock API 覆盖首屏骨架、加载失败错误卡与重试成功，不依赖 mock adapter 的延迟。
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HistoryPage from '../index.vue'
import { localStore, storageKeys } from '../../../unit/storage'

const { fetchHistoryMock } = vi.hoisted(() => ({ fetchHistoryMock: vi.fn() }))

vi.mock('../../../api/readings', () => ({
  fetchHistory: fetchHistoryMock,
}))

const originalMatchMedia = window.matchMedia

const HISTORY_PAYLOAD = {
  items: [
    {
      id: 'r1',
      title: 'A Quiet Morning',
      level: 'easy',
      questionCount: 3,
      status: 'submitted',
      score: 100,
      accuracy: 100,
      createdAt: '2026-10-05T09:20:00.000Z',
      submittedAt: '2026-10-05T09:34:00.000Z',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 10,
  stats: {
    totalCount: 1,
    averageAccuracy: 100,
    bestScore: 100,
    totalWordsRead: 120,
  },
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/history', name: 'history', component: HistoryPage },
      { path: '/settings', name: 'settings', component: { template: '<div />' } },
    ],
  })
}

async function mountHistory() {
  const router = createTestRouter()
  await router.push('/history')
  await router.isReady()

  const wrapper = mount(HistoryPage, {
    global: { plugins: [router] },
  })

  return { wrapper, router }
}

beforeEach(() => {
  fetchHistoryMock.mockReset()
  setActivePinia(createPinia())
  // 错误态只对登录用户出现；游客态由遮罩分支接管（md/45）
  localStore.set(storageKeys.accessToken, 'sess_history_errors')

  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})

afterAll(() => {
  window.matchMedia = originalMatchMedia
})

describe('History page states', () => {
  it('should show skeletons while the request is pending', async () => {
    fetchHistoryMock.mockImplementationOnce(() => new Promise(() => {}))

    const { wrapper } = await mountHistory()
    await nextTick()

    expect(wrapper.findAll('tbody tr.skeleton-row')).toHaveLength(8)
    expect(wrapper.findAll('.history-card.is-skeleton')).toHaveLength(4)
    // 骨架对读屏不可见，用 aria-busy + 隐藏文案告知加载状态
    expect(wrapper.get('.history-list').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('.history-list').text()).toContain('正在加载历史记录')
  })

  it('should show an error card and recover after retry', async () => {
    fetchHistoryMock.mockRejectedValueOnce(new Error('offline'))
    fetchHistoryMock.mockResolvedValueOnce(HISTORY_PAYLOAD)

    const { wrapper } = await mountHistory()
    await flushPromises()

    expect(wrapper.get('.state-card').attributes('role')).toBe('alert')
    expect(wrapper.text()).toContain('历史记录加载失败')
    expect(wrapper.text()).toContain('网络出了点问题，请稍后重试。')

    const retry = wrapper.findAll('button').find((button) => button.text() === '重试')
    await retry.trigger('click')
    await flushPromises()

    expect(wrapper.find('.state-card').exists()).toBe(false)
    expect(wrapper.findAll('tbody tr.history-row')).toHaveLength(1)
    expect(wrapper.text()).toContain('A Quiet Morning')
    expect(wrapper.findAll('.stat-value').map((node) => node.text())).toEqual([
      '1次',
      '100%',
      '100分',
      '120词',
    ])
  })
})
