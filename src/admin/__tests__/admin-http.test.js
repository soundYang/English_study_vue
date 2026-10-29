/**
 * 管理端请求层测试
 * 三件事必须锁死：令牌只带后台的、401 只清后台会话、裸 404 是「后台未配置」
 * 而不是普通业务错误（md/40 §2.2 / §6 / §10 第 9 条）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import http, { ADMIN_EXPIRED_EVENT, adminGet } from '../api/http'
import { fetchAdminUsers } from '../api/users'
import { adminAuth } from '../auth'

const originalAdapter = http.defaults.adapter

function futureIso() {
  return new Date(Date.now() + 60_000).toISOString()
}

function rejectWith({ status, data, headers = {} }) {
  http.defaults.adapter = async (requestConfig) => {
    const error = new Error(`Request failed with status code ${status}`)
    error.config = requestConfig
    error.response = { status, headers, data, config: requestConfig }
    throw error
  }
}

afterEach(() => {
  http.defaults.adapter = originalAdapter
  adminAuth.clear()
  localStorage.clear()
})

describe('admin http auth headers', () => {
  it('should send the admin token and never the user token or device id', async () => {
    let headers = null
    adminAuth.setSession({ token: 'admin_sess', expiresAt: futureIso() })
    localStorage.setItem('accessToken', JSON.stringify('user_sess'))

    http.defaults.adapter = async (requestConfig) => {
      headers = requestConfig.headers
      return {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: requestConfig,
      }
    }

    await adminGet('/admin/overview')

    expect(headers.Authorization).toBe('Bearer admin_sess')
    // 后台不是按设备限流的对象；带上用户设备头只会让两套会话纠缠
    expect(headers['X-Device-Id']).toBeUndefined()
  })
})

describe('admin users api', () => {
  it('should send hasApiKey only when it is true or false', async () => {
    let params = null
    http.defaults.adapter = async (requestConfig) => {
      params = requestConfig.params
      return {
        data: { items: [], total: 0 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: requestConfig,
      }
    }

    await fetchAdminUsers({ page: 2, hasApiKey: 'true' })
    expect(params).toMatchObject({ page: 2, hasApiKey: 'true' })

    await fetchAdminUsers({ hasApiKey: '' })
    expect(params.hasApiKey).toBeUndefined()

    // 后端对 hasApiKey=yes 返回 400，前端不应该把非法值发出去
    await fetchAdminUsers({ hasApiKey: 'yes' })
    expect(params.hasApiKey).toBeUndefined()
  })
})

describe('admin http normalisation', () => {
  it('should clear the admin session and broadcast on 401 ADMIN_AUTH_REQUIRED', async () => {
    adminAuth.setSession({ token: 'admin_sess', expiresAt: futureIso() })
    rejectWith({
      status: 401,
      data: { error: { code: 'ADMIN_AUTH_REQUIRED', message: '管理员登录已失效，请重新登录' } },
    })

    const handler = vi.fn()
    window.addEventListener(ADMIN_EXPIRED_EVENT, handler)

    await expect(adminGet('/admin/users')).rejects.toMatchObject({
      code: 'ADMIN_AUTH_REQUIRED',
    })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(adminAuth.token).toBe('')
    expect(localStorage.getItem('wr.admin.token')).toBeNull()
    window.removeEventListener(ADMIN_EXPIRED_EVENT, handler)
  })

  it('should not clear the session on a failed login', async () => {
    rejectWith({
      status: 401,
      data: { error: { code: 'ADMIN_AUTH_FAILED', message: '账号或密码不正确' } },
    })

    const handler = vi.fn()
    window.addEventListener(ADMIN_EXPIRED_EVENT, handler)

    await expect(adminGet('/admin/auth/login')).rejects.toMatchObject({
      code: 'ADMIN_AUTH_FAILED',
      message: '账号或密码不正确',
    })

    expect(handler).not.toHaveBeenCalled()
    window.removeEventListener(ADMIN_EXPIRED_EVENT, handler)
  })

  // 条件挂载时整段 /api/admin 是 Express 默认 404，没有 JSON error
  it('should treat a bare 404 as ADMIN_NOT_CONFIGURED', async () => {
    rejectWith({ status: 404, data: 'Not Found' })

    await expect(adminGet('/admin/overview')).rejects.toMatchObject({
      code: 'ADMIN_NOT_CONFIGURED',
      status: 404,
    })
  })

  // 业务 404 必须保留自己的码，否则详情页会把「不存在」显示成「后台未配置」
  it('should keep business 404 codes', async () => {
    rejectWith({
      status: 404,
      data: { error: { code: 'FEEDBACK_NOT_FOUND', message: '反馈不存在' } },
    })

    await expect(adminGet('/admin/feedback/xxx')).rejects.toMatchObject({
      code: 'FEEDBACK_NOT_FOUND',
    })
  })

  it('should keep the backend message for login throttling', async () => {
    rejectWith({
      status: 429,
      data: { error: { code: 'RATE_LIMITED', message: '登录失败次数过多，请 15 分钟后再试。' } },
    })

    await expect(adminGet('/admin/auth/login')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      message: '登录失败次数过多，请 15 分钟后再试。',
    })
  })

  it('should map a missing response to a network error', async () => {
    http.defaults.adapter = async () => {
      throw new Error('Network Error')
    }

    await expect(adminGet('/admin/overview')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    })
  })
})
