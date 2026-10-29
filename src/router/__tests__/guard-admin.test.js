/**
 * 后台守卫测试
 * 后台是独立会话：用户令牌进不了台账，管理员令牌也放不进用户页面。
 * 验证用户守卫与后台守卫的先后与互不干扰（md/40 §1.3、md/42）。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { registerGuards } from '../guards'
import { adminAuth } from '../../admin/auth'

const handlers = {}

function createRouter() {
  return {
    beforeEach(fn) {
      handlers.before = fn
    },
    afterEach(fn) {
      handlers.after = fn
    },
  }
}

function futureIso() {
  return new Date(Date.now() + 60_000).toISOString()
}

beforeEach(() => {
  localStorage.clear()
  adminAuth.clear()
  registerGuards(createRouter())
})

describe('admin guard', () => {
  it('should send an anonymous admin visit to the admin login page', async () => {
    const outcome = await handlers.before({
      name: 'admin-users',
      fullPath: '/admin/users?q=tom',
      meta: { admin: true },
    })

    // 不是用户登录页：后台有自己的入口
    expect(outcome).toEqual({
      name: 'admin-login',
      query: { redirect: '/admin/users?q=tom' },
    })
  })

  it('should keep the admin redirect even when a user token exists', async () => {
    localStorage.setItem('accessToken', JSON.stringify('user_sess'))

    const outcome = await handlers.before({
      name: 'admin-overview',
      fullPath: '/admin',
      meta: { admin: true },
    })

    expect(outcome).toEqual({ name: 'admin-login', query: { redirect: '/admin' } })
  })

  it('should let a valid admin token through', async () => {
    adminAuth.setSession({ token: 'admin_sess', expiresAt: futureIso(), username: 'root' })

    expect(
      await handlers.before({
        name: 'admin-users',
        fullPath: '/admin/users',
        meta: { admin: true },
      }),
    ).toBe(true)
  })

  it('should bounce a logged-in admin away from the login page', async () => {
    adminAuth.setSession({ token: 'admin_sess', expiresAt: futureIso(), username: 'root' })

    expect(
      await handlers.before({
        name: 'admin-login',
        fullPath: '/admin/login',
        meta: { admin: true, bare: true },
      }),
    ).toEqual({ name: 'admin-overview' })
  })

  it('should treat an expired admin token as anonymous', async () => {
    adminAuth.setSession({
      token: 'admin_sess',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })

    const outcome = await handlers.before({
      name: 'admin-feedback',
      fullPath: '/admin/feedback',
      meta: { admin: true },
    })

    expect(outcome).toEqual({ name: 'admin-login', query: { redirect: '/admin/feedback' } })
  })

  // 后台的改动不能松动用户侧：管理员令牌不算用户登录
  it('should still send anonymous protected user routes to the user login page', async () => {
    adminAuth.setSession({ token: 'admin_sess', expiresAt: futureIso(), username: 'root' })

    expect(
      await handlers.before({
        name: 'profile',
        fullPath: '/profile?tab=stats',
        meta: {},
      }),
    ).toEqual({
      name: 'login',
      query: { redirect: '/profile?tab=stats' },
    })
  })

  // 管理员令牌也不该影响公开页
  it('should leave the public home page alone for an admin token', async () => {
    adminAuth.setSession({ token: 'admin_sess', expiresAt: futureIso(), username: 'root' })

    expect(await handlers.before({ name: 'home', fullPath: '/', meta: { public: true } })).toBe(
      true,
    )
  })
})
