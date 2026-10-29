/**
 * 管理端用户台账：自备 API Key 可见性
 *
 * 锁住三件事：已接入 / 失效各自显示徽标、未接入不显示；
 * hasApiKey 进入 URL 与请求参数；非法 URL 值回落到「不过滤」。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import DropdownSelect from '../../component/DropdownSelect.vue'
import Users from '../views/Users.vue'

const api = vi.hoisted(() => ({ fetchAdminUsers: vi.fn() }))

vi.mock('../api/users', () => ({ fetchAdminUsers: api.fetchAdminUsers }))

const EmptyStub = { template: '<div />' }

const BASE_ROW = {
  phone: '138****0001',
  vocabulary: { personalWords: 120 },
  readings: { generated: 5, completed: 3, today: 1 },
  questions: { answered: 10, accuracy: 80 },
  tokens: { total: 1234, failed: 0 },
  failures: { count: 0 },
  quota: { enabled: true, remaining: 2 },
  createdAt: '2026-10-01T08:00:00.000Z',
  lastLoginAt: '2026-10-29T08:00:00.000Z',
}

const ROWS = [
  {
    ...BASE_ROW,
    dataKey: 'u1',
    username: 'alice',
    nickname: 'Alice',
    apiKey: { hasKey: true, provider: 'deepseek', status: 'active' },
  },
  {
    ...BASE_ROW,
    dataKey: 'u2',
    username: 'bob',
    nickname: 'Bob',
    apiKey: { hasKey: true, provider: 'deepseek', status: 'invalid' },
  },
  {
    ...BASE_ROW,
    dataKey: 'u3',
    username: 'carol',
    nickname: 'Carol',
    apiKey: { hasKey: false },
  },
]

let wrapper = null

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/users', name: 'admin-users', component: EmptyStub },
      { path: '/admin/users/:dataKey', name: 'admin-user', component: EmptyStub },
    ],
  })
}

async function mountUsers(path = '/admin/users') {
  const router = createTestRouter()
  await router.push(path)
  await router.isReady()

  wrapper = mount(Users, { global: { plugins: [router] } })
  await flushPromises()
  return router
}

function apiKeyDropdown() {
  return wrapper
    .findAllComponents(DropdownSelect)
    .find((item) => item.props('ariaLabel') === '自备 Key 筛选')
}

beforeEach(() => {
  api.fetchAdminUsers.mockReset()
  api.fetchAdminUsers.mockResolvedValue({ items: ROWS, total: ROWS.length })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('admin users api key badge', () => {
  it('should show a badge for active and invalid keys but not for users without one', async () => {
    await mountUsers()

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('已接入')
    expect(rows[1].text()).toContain('Key 失效')
    // invalid 仍是「接入过」，但不能被写成「未接入」
    expect(rows[1].text()).not.toContain('未接入')
    expect(rows[2].find('.api-key-pill').exists()).toBe(false)
  })

  it('should read hasApiKey from the URL and send it to the API', async () => {
    await mountUsers('/admin/users?hasApiKey=true')

    expect(api.fetchAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ hasApiKey: 'true' }))
  })

  it('should reset the page and update the URL when the filter changes', async () => {
    const router = await mountUsers('/admin/users?page=3&hasApiKey=true')

    apiKeyDropdown().vm.$emit('update:modelValue', 'false')
    await flushPromises()
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ hasApiKey: 'false' })
    expect(api.fetchAdminUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, hasApiKey: 'false' }),
    )
  })

  it('should fall back to no filter when the URL value is not true or false', async () => {
    await mountUsers('/admin/users?hasApiKey=yes')

    expect(api.fetchAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ hasApiKey: '' }))
  })
})
