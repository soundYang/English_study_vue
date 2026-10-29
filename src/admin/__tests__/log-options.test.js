/**
 * 日志页选项与纯函数
 *
 * 锁住两件事：时间范围按北京时间切「今天」，与浏览器时区无关；
 * 状态码颜色只分三档，非法值不给颜色。
 */
import { describe, expect, it } from 'vitest'
import { logStatusTone, resolveLogRange } from '../log-options'

const DAY_MS = 24 * 60 * 60 * 1000

describe('resolveLogRange', () => {
  // 北京时间 20:30 = UTC 12:30
  const now = new Date('2026-10-29T20:30:00+08:00')

  it('should start "today" at Beijing midnight instead of the local midnight', () => {
    // 北京 2026-10-29 00:00 = UTC 2026-10-28 16:00
    expect(resolveLogRange('today', now)).toEqual({
      value: 'today',
      days: 1,
      from: '2026-10-28T16:00:00.000Z',
    })
  })

  it('should subtract the window for the rolling ranges', () => {
    expect(resolveLogRange('7d', now)).toEqual({
      value: '7d',
      days: 7,
      from: new Date(now.getTime() - 7 * DAY_MS).toISOString(),
    })
    expect(resolveLogRange('30d', now)).toEqual({
      value: '30d',
      days: 30,
      from: new Date(now.getTime() - 30 * DAY_MS).toISOString(),
    })
  })

  it('should fall back to the 7-day window for unknown values', () => {
    expect(resolveLogRange('yesterday', now)).toEqual(resolveLogRange('7d', now))
    expect(resolveLogRange(undefined, now).days).toBe(7)
  })
})

describe('logStatusTone', () => {
  it('should colour 2xx green, 4xx warning and 5xx danger', () => {
    expect(logStatusTone(200)).toBe('is-success')
    expect(logStatusTone(429)).toBe('is-warning')
    expect(logStatusTone(503)).toBe('is-danger')
  })

  it('should stay muted when the status is not a number', () => {
    expect(logStatusTone(undefined)).toBe('is-muted')
    expect(logStatusTone('boom')).toBe('is-muted')
  })
})
