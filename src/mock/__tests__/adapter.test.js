/**
 * Mock 适配器测试
 * 覆盖分页筛选、词汇 CRUD 校验、安全 DTO、判分、重复提交、取消生成与历史统计。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { mockReadings, mockWords, resetMockDb, setMockLatency } from '../adapter'

beforeEach(() => {
  setMockLatency(0)
  resetMockDb()
})

describe('mockWords.list', () => {
  it('should paginate words and return counts from the whole library', async () => {
    const result = await mockWords.list({ page: 1, pageSize: 10 })

    expect(result.total).toBe(24)
    expect(result.items).toHaveLength(10)
    expect(result.page).toBe(1)
    expect(result.counts).toEqual({ all: 24, mastered: 11, learning: 9, new: 4 })
  })

  it('should sort newest first and clamp out-of-range pages', async () => {
    const first = await mockWords.list({ page: 1, pageSize: 10 })
    const last = await mockWords.list({ page: 99, pageSize: 10 })

    expect(first.items[0].word).toBe('wonder')
    expect(last.page).toBe(3)
    expect(last.items.at(-1).word).toBe('apple')
  })

  it('should filter by keyword and status', async () => {
    const search = await mockWords.list({ q: 'app', pageSize: 50 })
    const learning = await mockWords.list({ status: 'learning', pageSize: 50 })
    const chinese = await mockWords.list({ q: '勇气', pageSize: 50 })

    expect(search.items.map((item) => item.word)).toEqual(['happy', 'apple'])
    expect(learning.total).toBe(9)
    expect(chinese.items.map((item) => item.word)).toEqual(['courage'])
  })
})

describe('mockWords mutations', () => {
  it('should reject duplicate words with WORD_EXISTS', async () => {
    await expect(mockWords.create({ word: 'Apple', meaning: '苹果' })).rejects.toMatchObject({
      error: { code: 'WORD_EXISTS', field: 'word' },
    })
  })

  it('should reject invalid characters and keep the field name', async () => {
    await expect(mockWords.create({ word: '123', meaning: '' })).rejects.toMatchObject({
      error: { code: 'INVALID_REQUEST', field: 'word' },
    })
  })

  it('should normalize new words to lowercase and persist them', async () => {
    const created = await mockWords.create({ word: '  Orchid ', meaning: '兰花' })

    expect(created.word).toBe('orchid')
    expect(created.status).toBe('learning')

    const result = await mockWords.list({ q: 'orchid' })
    expect(result.total).toBe(1)

    const stored = JSON.parse(localStorage.getItem('wr.mock.db.v1'))
    expect(stored.words.some((item) => item.word === 'orchid')).toBe(true)
  })

  it('should keep reading snapshots after deleting a word', async () => {
    await mockWords.remove('w1')
    const reading = await mockReadings.get('r1')

    expect(reading.vocabulary).toContain('apple')
    await expect(mockWords.remove('w1')).rejects.toMatchObject({
      error: { code: 'WORD_NOT_FOUND' },
    })
  })
})

describe('mockReadings', () => {
  it('should generate a safe DTO without answer or translation fields', async () => {
    const reading = await mockReadings.generate({
      level: 'easy',
      targetWords: 100,
      questionCount: 3,
    })

    expect(reading.questions).toHaveLength(3)
    expect(reading.status).toBe('generated')
    expect(reading.translation).toBeUndefined()

    const serialized = JSON.stringify(reading)
    expect(serialized).not.toContain('correctAnswer')
    expect(serialized).not.toContain('explanation')
  })

  it('should reject generation when available vocabulary is insufficient', async () => {
    const all = await mockWords.list({ page: 1, pageSize: 50 })
    for (const item of all.items) {
      await mockWords.update(item.id, { status: 'new' })
    }

    await expect(
      mockReadings.generate({ level: 'easy', targetWords: 100, questionCount: 5 }),
    ).rejects.toMatchObject({ error: { code: 'INSUFFICIENT_VOCABULARY' } })
  })

  it('should abort generation when the signal is aborted', async () => {
    setMockLatency(50)
    const controller = new AbortController()
    const promise = mockReadings.generate(
      { level: 'easy', targetWords: 100, questionCount: 3 },
      { signal: controller.signal },
    )

    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('should grade submitted answers and reject duplicate submission', async () => {
    const reading = await mockReadings.get('r5')

    const result = await mockReadings.submit('r5', [
      { questionId: 1, selectedOption: 1 },
      { questionId: 2, selectedOption: 2 },
      { questionId: 3, selectedOption: 3 },
    ])

    expect(result.status).toBe('submitted')
    expect(result.totalQuestions).toBe(reading.questions.length)
    expect(result.correctCount).toBe(3)
    expect(result.score).toBe(60)
    expect(result.results[3]).toMatchObject({ selectedOption: null, isCorrect: false })
    expect(result.translation).toBeTruthy()

    await expect(mockReadings.submit('r5', [])).rejects.toMatchObject({
      error: { code: 'ALREADY_SUBMITTED' },
    })
  })

  it('should reject answers pointing at unknown questions', async () => {
    await expect(
      mockReadings.submit('r5', [{ questionId: 99, selectedOption: 0 }]),
    ).rejects.toMatchObject({ error: { code: 'INVALID_ANSWER' } })
  })

  it('should return 404 for missing readings', async () => {
    await expect(mockReadings.get('r404')).rejects.toMatchObject({
      error: { code: 'READING_NOT_FOUND' },
    })
  })
})

describe('mockReadings.history', () => {
  it('should compute stats from submitted readings only', async () => {
    const history = await mockReadings.history({ pageSize: 10 })

    expect(history.total).toBe(5)
    expect(history.items[0]).toMatchObject({ id: 'r5', status: 'generated', accuracy: null })
    expect(history.stats).toEqual({
      totalCount: 4,
      averageAccuracy: 82,
      bestScore: 100,
      totalWordsRead: expect.any(Number),
    })
    expect(history.stats.totalWordsRead).toBeGreaterThan(0)
  })

  it('should filter history by level without shrinking global stats', async () => {
    const easy = await mockReadings.history({ level: 'easy', pageSize: 10 })

    expect(easy.total).toBe(2)
    expect(easy.items.every((item) => item.level === 'easy')).toBe(true)
    expect(easy.stats.totalCount).toBe(4)
  })
})
