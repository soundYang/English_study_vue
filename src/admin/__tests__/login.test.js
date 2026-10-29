/**
 * 后台登录页测试
 * 三种异常必须是三种不同的界面：密码错误留在表单、限流显示后端原话、
 * 后台未配置显示配置卡。登录成功要把令牌写入独立会话并回跳 redirect。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import Login from '../views/Login.vue'
import { adminAuth } from '../auth'

const api = vi.hoisted(() => ({
  adminLogin: vi.fn(),
  fetchAdminMe: vi.fn(),
  adminLogout: vi.fn(),
}))

vi.mock('../api/auth', () => ({
  adminLogin: api.adminLogin,
  fetchAdminMe: api.fetchAdminMe,
  adminLogout: api.adminLogout,
}))

const EmptyStub = { template: '<div />' }

let wrapper = null

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/login', name: 'admin-login', component: Login },
      { path: '/admin', name: 'admin-overview', component: EmptyStub },
      { path: '/admin/users', name: 'admin-users', component: EmptyStub },
    ],
  })
}

async function mountLogin(path = '/admin/login') {
  const router = createTestRouter()
  await router.push(path)
  await router.isReady()

  wrapper = mount(Login, { global: { plugins: [router] } })
  return router
}

async function fillAndSubmit(username, password) {
  const inputs = wrapper.findAll('input')
  await inputs[0].setValue(username)
  await inputs[1].setValue(password)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  adminAuth.clear()
  api.adminLogin.mockReset()
  api.fetchAdminMe.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('admin login', () => {
  it('should keep the user on the form after a wrong password', async () => {
    api.adminLogin.mockRejectedValue({ code: 'ADMIN_AUTH_FAILED', message: '账号或密码不正确' })
    await mountLogin()

    await fillAndSubmit('root', 'wrong-password')

    expect(wrapper.text()).toContain('账号或密码不正确')
    // 账号不清空，让管理员只改密码
    expect(wrapper.findAll('input')[0].element.value).toBe('root')
    expect(adminAuth.token).toBe('')
  })

  it('should show the config card instead of a password error when admin is not configured', async () => {
    api.adminLogin.mockRejectedValue({ code: 'ADMIN_NOT_CONFIGURED', message: '后台未配置' })
    await mountLogin()

    await fillAndSubmit('root', 'secret')

    expect(wrapper.text()).toContain('后台未配置')
    expect(wrapper.text()).toContain('ADMIN_USERNAME')
    expect(wrapper.text()).not.toContain('账号或密码不正确')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('should pass the throttling message through unchanged', async () => {
    const message = '登录失败次数过多，请 15 分钟后再试。'
    api.adminLogin.mockRejectedValue({ code: 'RATE_LIMITED', message })
    await mountLogin()

    await fillAndSubmit('root', 'secret')

    expect(wrapper.text()).toContain(message)
  })

  it('should store the admin session and follow the redirect after login', async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString()
    api.adminLogin.mockResolvedValue({ token: 'admin_sess', expiresAt })
    api.fetchAdminMe.mockResolvedValue({ username: 'root', expiresAt })

    const router = await mountLogin('/admin/login?redirect=/admin/users')
    await fillAndSubmit('root', 'secret')

    expect(adminAuth.token).toBe('admin_sess')
    expect(adminAuth.username).toBe('root')
    expect(router.currentRoute.value.name).toBe('admin-users')
  })

  it('should explain an expired session that bounced back to the login page', async () => {
    adminAuth.clear('登录已过期，请重新登录')
    await mountLogin()

    expect(wrapper.text()).toContain('登录已过期，请重新登录')
  })

  // ?redirect= 不能被拿来跳到站外或绕回登录页
  it('should ignore redirects outside /admin or back to the login page', async () => {
    api.adminLogin.mockResolvedValue({
      token: 'admin_sess',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    api.fetchAdminMe.mockRejectedValue(new Error('me failed'))

    const router = await mountLogin('/admin/login?redirect=https://evil.example')
    await fillAndSubmit('root', 'secret')

    expect(router.currentRoute.value.name).toBe('admin-overview')
  })
})
