/**
 * 个人中心接口测试
 * 锁住字段白名单、昵称校验、按题正确率与固定的 12 周数组；
 * 使用真实 mock adapter（延迟 0），不触碰网络。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { changePassword, fetchProfile, fetchProfileStats, updateProfile } from '../profile'
import { resetMockDb, setMockLatency } from '../../mock/adapter'

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
