/**
 * 历史记录 · 游客态测试
 * 锁住 md/45 §5.5：不请求历史接口、统计与列表遮罩、筛选禁用、整行不可查看。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import HistoryPage from '../index.vue'

const { fetchHistoryMock } = vi.hoisted(() => ({ fetchHistoryMock: vi.fn() }))

vi.mock('../../../api/readings', () => ({ fetchHistory: fetchHistoryMock }))

let wrapper = null

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/history', name: 'history', component: HistoryPage },
      { path: '/login', name: 'login', component: { template: '<div />' } },
    ],
  })
}

async function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createTestRouter()
  await router.push('/history')
  await router.isReady()

  wrapper = mount(HistoryPage, {
    global: { plugins: [pinia, router] },
  })

  await flushPromises()
  return router
}

beforeEach(() => {
  localStorage.clear()
  fetchHistoryMock.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('History page · guest', () => {
  it('should not request the history API', async () => {
    await mountPage()

    expect(fetchHistoryMock).not.toHaveBeenCalled()
  })

  it('should mask the stats and the records', async () => {
    await mountPage()

    expect(wrapper.findAll('.stat-number')).toHaveLength(0)
    expect(wrapper.findAll('.stats-grid .guest-mask.is-number')).toHaveLength(4)
    expect(wrapper.findAll('tbody tr.history-row.is-masked')).toHaveLength(5)
    expect(wrapper.text()).toContain('登录后查看阅读历史')
    expect(wrapper.find('.list-footer').exists()).toBe(false)
  })

  it('should disable the level filter but keep it visible', async () => {
    await mountPage()

    const trigger = wrapper.get('.head-filter button')
    expect(trigger.attributes('disabled')).toBeDefined()
  })
})
