/**
 * Mock 的自选单词（md/54）
 * 形状与校验对齐后端：不传 = 自动、显式 [] = 400、超上限 = 400、
 * 词库外 / 未学习 = 422 FOCUS_WORDS_NOT_LEARNED（不占额度，在调用模型之前）。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { mockReadings, resetMockDb, setMockLatency } from '../adapter'

const BASE = { level: 'easy', targetWords: 100, questionCount: 5, vocabScope: ['all'] }
// 种子里 learning + mastered 一共 20 个；100 词的上限是 10 个自选词
const LEARNING = ['tired', 'study', 'garden', 'quiet', 'gentle']
const NEW_WORD = 'courage'

beforeEach(() => {
  setMockLatency(0)
  resetMockDb()
})

describe('mock focus words', () => {
  it('should report requested, invalid and max from the capacity check', async () => {
    const data = await mockReadings.capacity({
      targetWords: 100,
      vocabScope: ['all'],
      focusWords: ['tired', 'courage'],
    })

    expect(data.focusWords).toEqual({
      requested: ['tired', 'courage'],
      invalid: ['courage'],
      max: 10,
    })
  })

  it('should reject words that are not learned yet', async () => {
    await expect(
      mockReadings.generate({ ...BASE, focusWords: ['tired', NEW_WORD] }),
    ).rejects.toMatchObject({
      status: 422,
      error: {
        code: 'FOCUS_WORDS_NOT_LEARNED',
        field: 'focusWords',
        details: { kind: 'focus_words', words: [NEW_WORD], count: 1, max: 10 },
      },
    })
  })

  it('should treat an explicit empty array as a bad request', async () => {
    // 静默退回「自动」会让用户以为自己的选择生效了
    await expect(mockReadings.generate({ ...BASE, focusWords: [] })).rejects.toMatchObject({
      status: 400,
      error: { field: 'focusWords' },
    })
  })

  it('should reject more words than the article allows', async () => {
    const tooMany = [...LEARNING, 'apple', 'happy', 'angry', 'sunny', 'park', 'book', 'read']

    await expect(mockReadings.generate({ ...BASE, focusWords: tooMany })).rejects.toMatchObject({
      status: 400,
      error: { field: 'focusWords' },
    })
  })

  it('should reject words with characters that break tokenisation', async () => {
    await expect(
      mockReadings.generate({ ...BASE, focusWords: ['ice cream'] }),
    ).rejects.toMatchObject({ status: 400, error: { field: 'focusWords' } })
  })

  it('should normalize case and duplicates and echo them in the reading DTO', async () => {
    const reading = await mockReadings.generate({
      ...BASE,
      focusWords: [' Tired ', 'tired', 'Garden'],
    })

    expect(reading.focusWords.requested).toEqual(['tired', 'garden'])
    // missing 是「正文里没出现」，一定 requested 的子集
    expect(reading.focusWords.requested).toEqual(expect.arrayContaining(reading.focusWords.missing))
  })

  it('should keep the words on the task so retries reuse them', async () => {
    const task = await mockReadings.createTask({ ...BASE, focusWords: ['Tired', 'garden'] })

    expect(task.params.focusWords).toEqual(['tired', 'garden'])
  })

  it('should fail the task creation for invalid words as well', async () => {
    await expect(
      mockReadings.createTask({ ...BASE, focusWords: [NEW_WORD] }),
    ).rejects.toMatchObject({ status: 422, error: { code: 'FOCUS_WORDS_NOT_LEARNED' } })
  })
})
