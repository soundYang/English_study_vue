/**
 * 管理端会话测试
 * 令牌是后台唯一的凭据：过期判断、本地键隔离、过期清理都不能出错，
 * 否则要么把没登录的人放进台账，要么让用户令牌混进后台请求（md/40 §1.4）。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { adminAuth } from '../auth'

function futureIso(offsetMs = 60_000) {
  return new Date(Date.now() + offsetMs).toISOString()
}

beforeEach(() => {
  localStorage.clear()
  adminAuth.clear()
})

describe('adminAuth session', () => {
  it('should treat a fresh session as valid', () => {
    adminAuth.setSession({ token: 'admin_sess', expiresAt: futureIso(), username: 'root' })

    expect(adminAuth.isExpired).toBe(false)
    expect(adminAuth.hasValidToken()).toBe(true)
  })

  it('should reject an expired or incomplete session', () => {
    adminAuth.setSession({ token: 'admin_sess', expiresAt: futureIso(-1000) })
    expect(adminAuth.hasValidToken()).toBe(false)

    adminAuth.setSession({ token: '', expiresAt: futureIso() })
    expect(adminAuth.hasValidToken()).toBe(false)
  })

  // 后台与用户会话必须互不干扰：同一个浏览器里两套令牌各用各的键
  it('should only write the wr.admin.* keys', () => {
    adminAuth.setSession({ token: 'admin_sess', expiresAt: futureIso(), username: 'root' })

    expect(localStorage.getItem('wr.admin.token')).toBe(JSON.stringify('admin_sess'))
    expect(localStorage.getItem('wr.admin.username')).toBe(JSON.stringify('root'))
    expect(localStorage.getItem('accessToken')).toBeNull()
  })

  it('should restore a valid session from storage', () => {
    localStorage.setItem('wr.admin.token', JSON.stringify('admin_sess'))
    localStorage.setItem('wr.admin.expiresAt', JSON.stringify(futureIso()))
    localStorage.setItem('wr.admin.username', JSON.stringify('root'))
    adminAuth.token = ''
    adminAuth.expiresAt = ''
    adminAuth.username = ''

    adminAuth.restore()

    expect(adminAuth.token).toBe('admin_sess')
    expect(adminAuth.username).toBe('root')
    expect(adminAuth.hasValidToken()).toBe(true)
  })

  it('should clear an expired session while restoring', () => {
    localStorage.setItem('wr.admin.token', JSON.stringify('admin_sess'))
    localStorage.setItem('wr.admin.expiresAt', JSON.stringify(futureIso(-1000)))

    adminAuth.restore()

    expect(adminAuth.token).toBe('')
    expect(localStorage.getItem('wr.admin.token')).toBeNull()
  })

  it('should hand the expiry notice to the login page exactly once', () => {
    adminAuth.clear('登录已过期，请重新登录')

    expect(adminAuth.takeNotice()).toBe('登录已过期，请重新登录')
    expect(adminAuth.takeNotice()).toBe('')
  })
})
