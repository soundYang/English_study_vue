/**
 * 请求客户端测试
 * 429 的剩余秒数只来自响应头（后端 standardHeaders: 'draft-7'），
 * 归一化后的错误必须带上 retryAfter，三个生成入口才能共用同一份冷却。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import http, { apiGet, AUTH_EXPIRED_EVENT } from '../request'
import { localStore, storageKeys } from '../storage'

const originalAdapter = http.defaults.adapter

/** 用自定义 adapter 模拟一次 429，不改真实网络 */
function rejectWith(headers) {
  http.defaults.adapter = async (requestConfig) => {
    const error = new Error('Request failed with status code 429')
    error.config = requestConfig
    error.response = {
      status: 429,
      headers,
      data: { error: { code: 'RATE_LIMITED', message: '生成太频繁' } },
      config: requestConfig,
    }
    throw error
  }
}

afterEach(() => {
  http.defaults.adapter = originalAdapter
  localStore.remove(storageKeys.accessToken)
})

/** 用自定义 adapter 模拟一次 401，payload 决定业务码 */
function rejectUnauthorized(code) {
  http.defaults.adapter = async (requestConfig) => {
    const error = new Error('Request failed with status code 401')
    error.config = requestConfig
    error.response = {
      status: 401,
      headers: {},
      data: { error: { code, message: '请先登录' } },
      config: requestConfig,
    }
    throw error
  }
}

describe('request rate limit headers', () => {
  it('should read the reset seconds from the draft-7 RateLimit header', async () => {
    rejectWith({ ratelimit: 'limit=20, remaining=0, reset=42' })

    await expect(apiGet('/readings/generate/tasks/t1')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfter: 42,
    })
  })

  it('should fall back to Retry-After when RateLimit is absent', async () => {
    rejectWith({ 'retry-after': '30' })

    await expect(apiGet('/readings/generate/tasks/t1')).rejects.toMatchObject({
      retryAfter: 30,
    })
  })

  it('should leave retryAfter undefined when the server sends no hint', async () => {
    rejectWith({})

    const error = await apiGet('/readings/generate/tasks/t1').catch((reason) => reason)

    expect(error.code).toBe('RATE_LIMITED')
    expect(error.retryAfter).toBeUndefined()
  })
})

describe('request device header', () => {
  // 后端按 X-Device-Id 做设备维度的每日额度（md/35 §7）；格式不对会被静默忽略，
  // 所以这里连形状一起断言
  it('should send the device id on every request', async () => {
    let headers = null
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

    await apiGet('/words')

    expect(headers['X-Device-Id']).toMatch(/^[A-Za-z0-9_-]{16,64}$/)
  })
})

describe('request auth expiry', () => {
  it('should broadcast and clear the token on 401 AUTH_REQUIRED', async () => {
    localStore.set(storageKeys.accessToken, 'sess_expired')
    rejectUnauthorized('AUTH_REQUIRED')

    const handler = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, handler)

    await expect(apiGet('/profile')).rejects.toMatchObject({ code: 'AUTH_REQUIRED' })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(localStore.get(storageKeys.accessToken, '')).toBe('')
    window.removeEventListener(AUTH_EXPIRED_EVENT, handler)
  })

  it('should not broadcast a failed login', async () => {
    rejectUnauthorized('AUTH_INVALID_CREDENTIALS')

    const handler = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, handler)

    await expect(apiGet('/auth/login')).rejects.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
    })

    expect(handler).not.toHaveBeenCalled()
    window.removeEventListener(AUTH_EXPIRED_EVENT, handler)
  })
})
