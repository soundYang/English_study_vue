/**
 * 管理端日志 API 参数
 *
 * 后端把 `status` / `role` / `success` 当枚举校验，空串会被 400；
 * 请求层必须先丢掉空值，只把真正选中的筛选条件发出去。
 */
import { afterEach, describe, expect, it } from 'vitest'
import http from '../api/http'
import { fetchAccessLogs, fetchErrorLogs, fetchLoginLogs, fetchLogSummary } from '../api/logs'

const originalAdapter = http.defaults.adapter
let lastConfig = null

function respondWith(body) {
  http.defaults.adapter = async (config) => {
    lastConfig = config
    return { data: body, status: 200, statusText: 'OK', headers: {}, config }
  }
}

afterEach(() => {
  http.defaults.adapter = originalAdapter
  lastConfig = null
})

describe('logs api params', () => {
  it('should drop empty filters from the access query', async () => {
    respondWith({ total: 0, page: 1, size: 20, items: [] })

    await fetchAccessLogs({
      page: 2,
      size: 50,
      ip: '',
      userId: '',
      status: '',
      path: '',
      from: '2026-10-28T16:00:00.000Z',
    })

    expect(lastConfig.url).toBe('/admin/logs/access')
    expect(lastConfig.params).toMatchObject({
      page: 2,
      size: 50,
      from: '2026-10-28T16:00:00.000Z',
    })
    expect(lastConfig.params).not.toHaveProperty('ip')
    expect(lastConfig.params).not.toHaveProperty('userId')
    expect(lastConfig.params).not.toHaveProperty('status')
    expect(lastConfig.params).not.toHaveProperty('path')
  })

  it('should keep the exact status code and path substring for access logs', async () => {
    respondWith({ total: 0, page: 1, size: 20, items: [] })

    await fetchAccessLogs({ status: '429', path: '/readings', ip: '203.0.113.9' })

    expect(lastConfig.params).toMatchObject({ status: '429', path: '/readings', ip: '203.0.113.9' })
  })

  it('should forward code and path to the error logs endpoint', async () => {
    respondWith({ total: 0, page: 1, size: 20, items: [] })

    await fetchErrorLogs({ code: 'INTERNAL_ERROR', path: '/api/words', from: '' })

    expect(lastConfig.url).toBe('/admin/logs/errors')
    expect(lastConfig.params).toMatchObject({ code: 'INTERNAL_ERROR', path: '/api/words' })
    expect(lastConfig.params).not.toHaveProperty('from')
  })

  it('should send role and success only when they are chosen', async () => {
    respondWith({ total: 0, page: 1, size: 20, items: [] })

    await fetchLoginLogs({ role: 'admin', success: 'false', username: 'ali' })

    expect(lastConfig.url).toBe('/admin/logs/logins')
    expect(lastConfig.params).toMatchObject({ role: 'admin', success: 'false', username: 'ali' })
  })

  it('should ask the summary for the requested window', async () => {
    respondWith({ range: { days: 30 }, access: {}, errors: {}, logins: {} })

    await fetchLogSummary({ days: 30 })

    expect(lastConfig.url).toBe('/admin/logs/summary')
    expect(lastConfig.params).toMatchObject({ days: 30 })
  })
})
