/**
 * 请求客户端测试
 * 429 的剩余秒数只来自响应头（后端 standardHeaders: 'draft-7'），
 * 归一化后的错误必须带上 retryAfter，三个生成入口才能共用同一份冷却。
 */
import { afterEach, describe, expect, it } from 'vitest'
import http, { apiGet } from '../request'

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
})

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
