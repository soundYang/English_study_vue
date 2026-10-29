/**
 * 登录状态 store 测试
 * 只覆盖两件与安全相关的事：本地缓存只留展示字段（md/40 N-3），
 * 退登要顺手清掉生成任务缓存（md/40 N-2）。接口全部走 vi.mock，不碰网络。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { localStore, storageKeys } from '../../unit/storage'

vi.mock('../../api/auth', () => ({
  loginAccount: vi.fn(),
  logoutAccount: vi.fn(),
  registerAccount: vi.fn(),
}))

vi.mock('../../api/profile', () => ({ fetchProfile: vi.fn() }))

import { loginAccount, logoutAccount } from '../../api/auth'
import { useAuthStore } from '../model/auth'

/** 后端 / Mock 返回的完整用户 DTO：手机号、签名、注册时间都在里面 */
const FULL_USER = {
  id: 'u1',
  username: 'sound',
  nickname: 'Sound',
  signature: '慢一点也没关系',
  phone: '13800000000',
  createdAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('auth store cached user', () => {
  it('should cache only the display fields after login', async () => {
    loginAccount.mockResolvedValue({ token: 'tk_1', expiresAt: null, user: FULL_USER })

    const store = useAuthStore()
    await store.login({ usernameOrPhone: 'sound', password: 'sound1234' })

    // 顶栏只需要 id / username / nickname，手机号这类资料不该落进 localStorage
    expect(localStore.get(storageKeys.authUser)).toEqual({
      id: 'u1',
      username: 'sound',
      nickname: 'Sound',
    })
    expect(store.displayName).toBe('Sound')
  })
})

describe('auth store session cleanup', () => {
  it('should clear the stored generation task when logging out', async () => {
    logoutAccount.mockResolvedValue({ ok: true })
    localStore.set(storageKeys.accessToken, 'tk_1')
    localStore.set(storageKeys.authUser, { id: 'u1', username: 'sound', nickname: 'Sound' })
    localStore.set(storageKeys.generationTask, {
      taskId: 't1',
      from: 'settings',
      availableWords: 120,
      level: 'hard',
      targetWords: 300,
      questionCount: 5,
    })

    const store = useAuthStore()
    await store.logout()

    // 任务缓存带着上一个账号的难度与篇幅，退登必须一起清掉（md/40 N-2）
    expect(localStore.get(storageKeys.generationTask)).toBeNull()
    expect(localStore.get(storageKeys.accessToken)).toBeNull()
    expect(localStore.get(storageKeys.authUser)).toBeNull()
    expect(store.user).toBeNull()
  })

  it('should clear the stored generation task when the session expires', async () => {
    localStore.set(storageKeys.accessToken, 'tk_1')
    localStore.set(storageKeys.generationTask, { taskId: 't1', level: 'hard' })

    const store = useAuthStore()
    store.clearSession()

    expect(localStore.get(storageKeys.generationTask)).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })
})
