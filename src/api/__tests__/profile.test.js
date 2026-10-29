/**
 * 个人中心接口测试
 * 锁住字段白名单、昵称校验、按题正确率与固定的 12 周数组；
 * 使用真实 mock adapter（延迟 0），不触碰网络。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  changePassword,
  deleteApiKey,
  fetchApiKey,
  fetchProfile,
  fetchProfileStats,
  saveApiKey,
  updateProfile,
  verifyApiKey,
} from '../profile'
import { resetMockDb, setMockLatency } from '../../mock/adapter'

const VALID_KEY = `sk-${'a'.repeat(40)}`
const INVALID_KEY = `sk-invalid-${'b'.repeat(40)}`
const OFFLINE_KEY = `sk-offline-${'c'.repeat(40)}`

beforeEach(() => {
  localStorage.clear()
  resetMockDb()
  setMockLatency(0)
})

describe('profile api', () => {
  it('should return a safe user without auth internals', async () => {
    const data = await fetchProfile()

    expect(data.user).toMatchObject({
      username: 'local-user',
      nickname: 'Sound',
      signature: '少年，大胆走，怎么都是路。',
    })
    // 白名单：dataKey / passwordHash / usernameLower 一律不出现在响应里
    expect(data.user.dataKey).toBeUndefined()
    expect(data.user.passwordHash).toBeUndefined()
    expect(data.user.usernameLower).toBeUndefined()
  })

  it('should trim and persist a new nickname and signature', async () => {
    const data = await updateProfile({ nickname: '  小树  ', signature: '  慢一点也没关系  ' })

    expect(data.user.nickname).toBe('小树')
    expect(data.user.signature).toBe('慢一点也没关系')

    const again = await fetchProfile()
    expect(again.user.nickname).toBe('小树')
  })

  it('should reject an empty or overlong nickname', async () => {
    await expect(updateProfile({ nickname: '   ' })).rejects.toMatchObject({
      error: { code: 'INVALID_REQUEST', field: 'nickname' },
    })
    await expect(updateProfile({ nickname: 'a'.repeat(21) })).rejects.toMatchObject({
      error: { field: 'nickname' },
    })
  })

  it('should compute accuracy by questions and always return 12 weeks', async () => {
    const data = await fetchProfileStats()

    expect(data.weekly).toHaveLength(12)
    expect(data.questions.answered).toBeGreaterThan(0)
    expect(data.questions.correct + data.questions.wrong).toBe(data.questions.answered)
    expect(data.questions.accuracy).toBe(
      Math.round((data.questions.correct / data.questions.answered) * 100),
    )
    // token 包含未提交的稿子，所以生成篇数一定不少于已完成篇数
    expect(data.reading.totalTokens).toBeGreaterThan(0)
    expect(data.reading.generatedCount).toBeGreaterThanOrEqual(data.reading.completedCount)
  })

  it('should validate the password form rules', async () => {
    await expect(
      changePassword({ oldPassword: '', newPassword: 'abcdefgh' }),
    ).rejects.toMatchObject({ error: { field: 'oldPassword' } })
    await expect(
      changePassword({ oldPassword: 'oldpass1', newPassword: 'short' }),
    ).rejects.toMatchObject({ error: { field: 'newPassword' } })
    await expect(
      changePassword({ oldPassword: 'oldpass1', newPassword: 'oldpass1' }),
    ).rejects.toMatchObject({ error: { code: 'INVALID_REQUEST' } })
    await expect(
      changePassword({ oldPassword: 'oldpass1', newPassword: 'newpass12' }),
    ).resolves.toEqual({ ok: true })
  })
})

describe('user api key api', () => {
  it('should report an enabled feature with no key before importing', async () => {
    const data = await fetchApiKey()

    expect(data).toEqual({
      enabled: true,
      supportedProviders: ['deepseek'],
      key: null,
    })
  })

  it('should only return the masked key after a successful import', async () => {
    const data = await saveApiKey({ apiKey: `  ${VALID_KEY}  ` })

    expect(data.enabled).toBe(true)
    expect(data.key).toMatchObject({
      provider: 'deepseek',
      maskedKey: `sk-****${VALID_KEY.slice(-4)}`,
      status: 'active',
      lastUsedAt: null,
    })
    // 任何响应都不带明文与密文
    expect(JSON.stringify(data)).not.toContain(VALID_KEY)
    expect(JSON.stringify(data)).not.toContain('cipher')

    const again = await fetchApiKey()
    expect(again.key.maskedKey).toBe(data.key.maskedKey)
  })

  it('should reject a malformed key on the apiKey field without storing it', async () => {
    await expect(saveApiKey({ apiKey: 'not-a-key' })).rejects.toMatchObject({
      error: { code: 'INVALID_REQUEST', field: 'apiKey' },
    })

    const data = await fetchApiKey()
    expect(data.key).toBeNull()
  })

  it('should keep the previous key when the replacement is rejected upstream', async () => {
    const first = await saveApiKey({ apiKey: VALID_KEY })

    await expect(saveApiKey({ apiKey: INVALID_KEY })).rejects.toMatchObject({
      error: { code: 'USER_API_KEY_INVALID', field: 'apiKey' },
    })

    const data = await fetchApiKey()
    expect(data.key.maskedKey).toBe(first.key.maskedKey)
  })

  it('should report a verification failure separately from a bad key', async () => {
    await expect(saveApiKey({ apiKey: OFFLINE_KEY })).rejects.toMatchObject({
      error: { code: 'USER_API_KEY_VERIFY_FAILED' },
    })
  })

  it('should refuse to verify when nothing was imported', async () => {
    await expect(verifyApiKey()).rejects.toMatchObject({
      error: { code: 'USER_API_KEY_MISSING' },
    })
  })

  it('should refresh the verified time when verifying an imported key', async () => {
    const first = await saveApiKey({ apiKey: VALID_KEY })
    const verified = await verifyApiKey()

    expect(verified.key.status).toBe('active')
    expect(verified.key.createdAt).toBe(first.key.createdAt)
    expect(verified.key.lastVerifiedAt >= first.key.lastVerifiedAt).toBe(true)
  })

  it('should delete idempotently and fall back to free generation', async () => {
    await saveApiKey({ apiKey: VALID_KEY })

    await expect(deleteApiKey()).resolves.toEqual({ ok: true, key: null })
    await expect(deleteApiKey()).resolves.toEqual({ ok: true, key: null })
    expect((await fetchApiKey()).key).toBeNull()
  })
})
