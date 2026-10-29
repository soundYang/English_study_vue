/**
 * 用户反馈接口测试
 * 锁住 md/37 §5.1 的口径：content 去空白后 10–2000 字、category 六选一、
 * contact / page 各 ≤100 字；使用真实 mock adapter（延迟 0），不触碰网络。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { submitFeedback } from '../feedback'
import { setMockLatency } from '../../mock/adapter'

beforeEach(() => {
  localStorage.clear()
  setMockLatency(0)
})

describe('feedback api', () => {
  it('should trim the content and return an open feedback record', async () => {
    const data = await submitFeedback({
      category: 'bug',
      content: '  生成到一半一直停在 60%  ',
      contact: '  微信 xxx  ',
      page: '/generating',
    })

    expect(data.id).toMatch(/^fb_/)
    expect(data.status).toBe('open')
    expect(Number.isNaN(new Date(data.createdAt).getTime())).toBe(false)
  })

  it('should reject content shorter than 10 characters with the field and limits', async () => {
    await expect(submitFeedback({ category: 'bug', content: '太短了' })).rejects.toMatchObject({
      error: {
        code: 'FEEDBACK_TOO_SHORT',
        field: 'content',
        details: { minLength: 10, maxLength: 2000 },
      },
    })
  })

  it('should reject content longer than 2000 characters', async () => {
    await expect(
      submitFeedback({ category: 'other', content: 'a'.repeat(2001) }),
    ).rejects.toMatchObject({
      error: { code: 'FEEDBACK_TOO_LONG', field: 'content' },
    })
  })

  it('should reject an unknown category and an overlong contact', async () => {
    await expect(
      submitFeedback({ category: 'complaint', content: '这是一条足够长的反馈内容' }),
    ).rejects.toMatchObject({ error: { code: 'INVALID_REQUEST', field: 'category' } })

    await expect(
      submitFeedback({
        category: 'other',
        content: '这是一条足够长的反馈内容',
        contact: 'x'.repeat(101),
      }),
    ).rejects.toMatchObject({ error: { field: 'contact' } })
  })
})
