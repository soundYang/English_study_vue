/**
 * 管理端日志页
 *
 * 覆盖四个 tab 的挂载与切换、URL 即现场、三类列表的关键展示
 * （状态码颜色 / 堆栈折叠 / 失败行淡红）以及筛选条件真正进入请求参数。
 * 接口全部替换为 mock：页面逻辑只依赖响应形状。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import DropdownSelect from '../../component/DropdownSelect.vue'
import SegmentedControl from '../../component/SegmentedControl.vue'
import Logs from '../views/Logs.vue'

const api = vi.hoisted(() => ({
  fetchAccessLogs: vi.fn(),
  fetchErrorLogs: vi.fn(),
  fetchLoginLogs: vi.fn(),
  fetchLogSummary: vi.fn(),
}))

vi.mock('../api/logs', () => api)

const EmptyStub = { template: '<div />' }

const SUMMARY = {
  range: { days: 7, from: '2026-10-22T00:00:00.000Z', to: '2026-10-29T00:00:00.000Z' },
  access: { total: 1200, ok: 1160, clientError: 36, serverError: 4, uniqueIps: 12 },
  errors: {
    total: 4,
    byCode: [
      { code: 'INTERNAL_ERROR', count: 3 },
      { code: 'AI_PROVIDER_ERROR', count: 1 },
    ],
  },
  logins: { total: 20, failed: 2, uniqueUsers: 8, byRole: { user: 18, admin: 2 } },
}

const ACCESS_ROWS = [
  {
    id: 'a1',
    createdAt: '2026-10-29T12:00:00.000Z',
    method: 'GET',
    path: '/api/readings/1?x=1',
    statusCode: 200,
    durationMs: 12,
    ip: '203.0.113.9',
    userId: 'u1',
    userAgent: 'UA',
    origin: '',
    requestId: 'req_1',
  },
  {
    id: 'a2',
    createdAt: '2026-10-29T12:01:00.000Z',
    method: 'POST',
    path: '/api/readings',
    statusCode: 503,
    durationMs: 1500,
    ip: '203.0.113.9',
    userId: '',
    userAgent: '',
    origin: '',
    requestId: 'req_2',
  },
]

const ERROR_ROWS = [
  {
    id: 'e1',
    createdAt: '2026-10-29T12:02:00.000Z',
    requestId: 'req_9',
    method: 'POST',
    path: '/api/readings',
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: '上游模型挂了',
    stack: 'Error: 上游模型挂了\n  at generate (reading.service.js:10)',
    ip: '203.0.113.9',
    userId: 'u1',
    userAgent: 'UA',
  },
]

const LOGIN_ROWS = [
  {
    id: 'l1',
    createdAt: '2026-10-29T09:00:00.000Z',
    userId: 'u1',
    username: 'alice',
    role: 'user',
    success: true,
    ip: '1.2.3.4',
    userAgent: 'Mozilla/5.0',
  },
  {
    id: 'l2',
    createdAt: '2026-10-29T09:01:00.000Z',
    userId: '',
    username: 'mallory',
    role: 'user',
    success: false,
    ip: '5.6.7.8',
    userAgent: 'curl/8',
  },
]

let wrapper = null

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/logs', name: 'admin-logs', component: EmptyStub },
      { path: '/admin/users/:dataKey', name: 'admin-user', component: EmptyStub },
    ],
  })
}

async function mountLogs(path = '/admin/logs') {
  const router = createTestRouter()
  await router.push(path)
  await router.isReady()

  wrapper = mount(Logs, { global: { plugins: [router] } })
  await flushPromises()
  return router
}

function dropdown(ariaLabel) {
  return wrapper
    .findAllComponents(DropdownSelect)
    .find((item) => item.props('ariaLabel') === ariaLabel)
}

function tabControl() {
  return wrapper.findAllComponents(SegmentedControl)[0]
}

function waitForDebounce() {
  return new Promise((resolve) => setTimeout(resolve, 320))
}

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchLogSummary.mockResolvedValue(SUMMARY)
  api.fetchAccessLogs.mockResolvedValue({ total: ACCESS_ROWS.length, items: ACCESS_ROWS })
  api.fetchErrorLogs.mockResolvedValue({ total: ERROR_ROWS.length, items: ERROR_ROWS })
  api.fetchLoginLogs.mockResolvedValue({ total: LOGIN_ROWS.length, items: LOGIN_ROWS })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('admin logs overview', () => {
  it('should load the 7-day summary by default', async () => {
    await mountLogs()

    expect(api.fetchLogSummary).toHaveBeenCalledWith({ days: 7 })
    const cards = wrapper.findAll('.stat-card')
    expect(cards).toHaveLength(4)

    // 访问日志只记失败请求（md/53 §12），卡片口径是失败量而不是全站流量
    const accessCard = cards.find((card) => card.text().includes('失败请求'))
    expect(accessCard.get('.stat-value').text()).toBe('1,200')
    expect(accessCard.get('.stat-hint').text()).toContain('4xx 36')
    expect(accessCard.get('.stat-hint').text()).toContain('5xx 4')
    expect(accessCard.get('.stat-hint').text()).toContain('不含成功的 2xx / 3xx')

    // 错误码 Top 10：只有报错日志里的 5xx
    expect(wrapper.get('.errors-table').text()).toContain('INTERNAL_ERROR')
    expect(wrapper.get('.errors-table').text()).toContain('75%')
  })

  it('should refetch the summary when the time window changes', async () => {
    const router = await mountLogs()

    dropdown('时间范围').vm.$emit('update:modelValue', '30d')
    await flushPromises()
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ range: '30d' })
    expect(api.fetchLogSummary).toHaveBeenLastCalledWith({ days: 30 })
  })
})

describe('admin logs access tab', () => {
  it('should switch tabs through the URL and request the first page', async () => {
    const router = await mountLogs()

    tabControl().vm.$emit('update:modelValue', 'access')
    await flushPromises()
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ tab: 'access' })
    expect(api.fetchAccessLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        size: 20,
        ip: '',
        status: '',
        from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    )
  })

  it('should colour slow and failing requests and link known users', async () => {
    await mountLogs('/admin/logs?tab=access')

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)

    expect(rows[0].text()).toContain('GET')
    expect(rows[0].text()).toContain('/api/readings/1?x=1')
    expect(rows[0].get('a').attributes('href')).toBe('/admin/users/u1')

    // 503 红、1500ms 标黄；匿名请求不给出用户链接
    expect(rows[1].find('.is-danger').text()).toBe('503')
    expect(rows[1].find('.is-warning').text()).toContain('1500 ms')
    expect(rows[1].find('a').exists()).toBe(false)
    expect(rows[1].text()).toContain('未登录')
  })

  it('should send the chosen status code and reset to page one', async () => {
    await mountLogs('/admin/logs?tab=access')

    dropdown('按状态码筛选').vm.$emit('update:modelValue', '429')
    await waitForDebounce()
    await flushPromises()

    expect(api.fetchAccessLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: '429', page: 1 }),
    )
  })
})

describe('admin logs error tab', () => {
  it('should fold the stack behind a details element', async () => {
    await mountLogs('/admin/logs?tab=errors')

    const details = wrapper.get('details.stack')
    expect(details.get('summary').text()).toBe('堆栈')
    expect(details.get('pre').text()).toContain('at generate')
    // 默认收起：没有 open 属性
    expect(details.attributes('open')).toBeUndefined()
    expect(wrapper.text()).toContain('INTERNAL_ERROR')
  })
})

describe('admin logs login tab', () => {
  it('should tint failed attempts and keep successful ones normal', async () => {
    await mountLogs('/admin/logs?tab=logins')

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)

    expect(rows[0].classes()).not.toContain('is-login-failed')
    expect(rows[0].text()).toContain('成功')
    expect(rows[1].classes()).toContain('is-login-failed')
    expect(rows[1].text()).toContain('失败')
    // 失败记录的 userId 为空，用户列不链接
    expect(rows[1].find('a').exists()).toBe(false)
  })

  it('should pass the success filter through as a string', async () => {
    await mountLogs('/admin/logs?tab=logins')

    const successFilter = wrapper
      .findAllComponents(SegmentedControl)
      .find((item) => item.props('ariaLabel') === '按结果筛选')
    successFilter.vm.$emit('update:modelValue', 'false')
    await waitForDebounce()
    await flushPromises()

    expect(api.fetchLoginLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ success: 'false', page: 1 }),
    )
  })
})
