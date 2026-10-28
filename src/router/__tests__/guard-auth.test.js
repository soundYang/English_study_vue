/**
 * 强制鉴权守卫测试
 * vitest.config.js 把 VITE_AUTH_ENFORCED 锁成 false，保持其余用例的基线；
 * 这里 mock config 把开关打开，覆盖「未登录去 /login、带 redirect、bare 页放行、有令牌放行」。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerGuards } from '../guards'
import { localStore, storageKeys } from '../../unit/storage'

vi.mock('../../config', () => ({
  config: {
    apiBaseUrl: 'http://localhost:3000/api',
    useMock: true,
    authEnforced: true,
    requestTimeout: 15000,
    generateTimeout: 90000,
    isDev: true,
    isProd: false,
  },
}))

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

beforeEach(() => {
  localStorage.clear()
  registerGuards(createRouter())
})

describe('auth guard with enforcement on', () => {
  it('should send an anonymous visit to the login page', async () => {
    const outcome = await handlers.before({ name: 'home', fullPath: '/', meta: {} })

    expect(outcome).toEqual({ name: 'login', query: {} })
  })

  it('should keep the target path in the redirect query', async () => {
    const outcome = await handlers.before({
      name: 'profile',
      fullPath: '/profile?tab=stats',
      meta: { title: '个人中心' },
    })

    expect(outcome).toEqual({
      name: 'login',
      query: { redirect: '/profile?tab=stats' },
    })
  })

  it('should let the bare auth pages through', async () => {
    expect(await handlers.before({ name: 'login', fullPath: '/login', meta: { bare: true } })).toBe(
      true,
    )
    expect(
      await handlers.before({ name: 'register', fullPath: '/register', meta: { bare: true } }),
    ).toBe(true)
  })

  it('should let a request with a token through', async () => {
    localStore.set(storageKeys.accessToken, 'sess_test')

    expect(await handlers.before({ name: 'home', fullPath: '/', meta: {} })).toBe(true)
  })
})
