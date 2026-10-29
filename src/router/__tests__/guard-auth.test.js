/**
 * 用户路由守卫测试
 * 公开页白名单：只有 meta.public 与 bare 页放行；业务页默认要求令牌（md/42）。
 * 前端门禁不再依赖 VITE_AUTH_ENFORCED，这里不再 mock config。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { registerGuards } from '../guards'
import { localStore, storageKeys } from '../../unit/storage'

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

describe('auth guard', () => {
  it('should let the public home page through without a token', async () => {
    const outcome = await handlers.before({
      name: 'home',
      fullPath: '/',
      meta: { public: true },
    })

    expect(outcome).toBe(true)
  })

  it('should send an anonymous protected visit to the login page', async () => {
    const outcome = await handlers.before({
      name: 'words',
      fullPath: '/words',
      meta: { title: '我的单词' },
    })

    expect(outcome).toEqual({ name: 'login', query: { redirect: '/words' } })
  })

  it('should keep the target path and query in the redirect', async () => {
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

  it('should let the public 404 page through', async () => {
    expect(
      await handlers.before({ name: 'not-found', fullPath: '/missing', meta: { public: true } }),
    ).toBe(true)
  })

  it('should let guest browse pages through without a token', async () => {
    // md/45：业务页自己决定遮罩，不再统一送去登录
    expect(
      await handlers.before({
        name: 'words',
        fullPath: '/words',
        meta: { title: '我的单词', guestMode: 'browse' },
      }),
    ).toBe(true)
    expect(
      await handlers.before({
        name: 'reading',
        fullPath: '/readings/r1',
        params: { id: 'r1' },
        meta: { guestMode: 'gate' },
      }),
    ).toBe(true)
    expect(
      await handlers.before({
        name: 'generating',
        fullPath: '/generating',
        meta: { guestMode: 'redirect' },
      }),
    ).toBe(true)
  })

  it('should still require a token without guestMode', async () => {
    // fail-safe：新加的保护页忘了标注时，默认仍然拦截
    const outcome = await handlers.before({
      name: 'unknown-protected',
      fullPath: '/unknown',
      meta: {},
    })

    expect(outcome).toEqual({ name: 'login', query: { redirect: '/unknown' } })
  })

  it('should let a protected visit with a token through', async () => {
    localStore.set(storageKeys.accessToken, 'sess_test')

    expect(
      await handlers.before({ name: 'words', fullPath: '/words', meta: { title: '我的单词' } }),
    ).toBe(true)
  })
})
