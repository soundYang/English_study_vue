/**
 * Mock 适配器测试
 * 覆盖分页筛选、词汇 CRUD 校验、安全 DTO、判分、重复提交、取消生成、历史统计，
 * 以及任务化生成的状态机（建任务 → 轮询 → 取消 / 重试 / 幂等）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockReadings, mockWords, resetMockDb, setMockLatency } from '../adapter'

beforeEach(() => {
  setMockLatency(0)
  resetMockDb()
})

describe('mockWords cocaRank', () => {
  it('should give dictionary words their rank and manual words null', async () => {
    const { items } = await mockWords.list({ page: 1, pageSize: 50 })
    const apple = items.find((item) => item.word === 'apple')
    const story = items.find((item) => item.word === 'story')

    // 数字与后端 data/word-ranks.json 一致
    expect(apple.cocaRank).toBe(2718)
    // 手填词是 null 而不是 0：0 会被当成「第 0 名」
    expect(story.source).toBe('manual')
    expect(story.cocaRank).toBeNull()
  })

  it('should reject editing the rank through the update endpoint', async () => {
    await expect(mockWords.update('w1', { cocaRank: 1 })).rejects.toMatchObject({
      error: { code: 'READONLY_FIELD', field: 'cocaRank' },
    })
  })
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

    const stored = JSON.parse(localStorage.getItem('wr.mock.db.v2'))
    expect(stored.words.some((item) => item.word === 'orchid')).toBe(true)
  })

  it('should snapshot phonetic and senses when creating from a dictionary entry', async () => {
    const created = await mockWords.create({
      word: 'abandon',
      status: 'learning',
      source: 'dictionary',
      dictionaryId: 'dict_abandon',
      phonetic: { uk: '/əˈbæn.dən/', us: '/əˈbæn.dən/' },
      senses: [
        { pos: 'v.', meaning: '放弃；抛弃' },
        { pos: 'n.', meaning: '放任；放纵' },
      ],
    })

    expect(created.source).toBe('dictionary')
    expect(created.phonetic.uk).toBe('/əˈbæn.dən/')
    expect(created.senses).toHaveLength(2)
    // 摘要取前两条义项拼接，列表与搜索复用
    expect(created.summary).toBe('放弃；抛弃；放任；放纵')
    // 词库条目不再保留顶层 meaning 字段
    expect(created.meaning).toBeUndefined()
  })

  it('should downgrade a dictionary entry when its word changes', async () => {
    const updated = await mockWords.update('w16', { word: 'memories' })

    expect(updated.word).toBe('memories')
    expect(updated.source).toBe('manual')
    expect(updated.dictionaryId).toBeNull()
    expect(updated.phonetic).toBeNull()
    // 词频跟着词条走，降级后没有名次可查
    expect(updated.cocaRank).toBeNull()
    expect(updated.senses).toEqual([])
  })

  it('should reject editing dictionary fields through the update endpoint', async () => {
    await expect(mockWords.update('w16', { senses: [] })).rejects.toMatchObject({
      error: { code: 'READONLY_FIELD', field: 'senses' },
    })
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
    // A1 / A2 / A3：真实后端由 DTO 直接给出，mock 必须补齐，否则本地看不到新 UI
    expect(reading.actualWords).toBeGreaterThan(0)
    expect(reading.newWords.length).toBeGreaterThan(0)
    expect(reading.tokenUsage.totalTokens).toBeGreaterThan(0)

    const serialized = JSON.stringify(reading)
    expect(serialized).not.toContain('correctAnswer')
    expect(serialized).not.toContain('explanation')
  })

  it('should expose the final-mode ladder without widening the effective cap', async () => {
    const data = await mockReadings.capacity({ targetWords: 700 })

    expect(data.finalMode).toMatchObject({ unlocked: false, unlockAt: 3000, maxTargetWords: 1000 })
    expect(data.levels.hard.finalMode.supported).toBe(true)
    expect(data.levels.easy.finalMode.supported).toBe(false)
    // 种子词库远不到 3000，hard 的上限仍然是 600
    expect(data.levels.hard.maxTargetWords).toBe(600)
    expect(data.levels.hard.lengths).toHaveLength(10)
  })

  it('should reject final-mode lengths until the personal library reaches 3000', async () => {
    await expect(
      mockReadings.generate({ level: 'hard', targetWords: 700, questionCount: 3 }),
    ).rejects.toMatchObject({
      error: {
        code: 'INVALID_REQUEST',
        details: { kind: 'final_mode_locked', metric: 'personal_words' },
      },
    })
  })

  it('should reject lengths above the level cap', async () => {
    await expect(
      mockReadings.generate({ level: 'easy', targetWords: 400, questionCount: 3 }),
    ).rejects.toMatchObject({
      error: {
        code: 'INVALID_REQUEST',
        details: { kind: 'target_words_cap', maxTargetWords: 300 },
      },
    })
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

describe('mockReadings vocabScope', () => {
  it('should shrink the pool to the chosen scope', async () => {
    const all = await mockReadings.capacity({ targetWords: 100 })
    const today = await mockReadings.capacity({ targetWords: 100, vocabScope: ['today_new'] })

    expect(all.available).toBe(20)
    // 种子词的创建日期都是旧的，「今天新学」一个也选不出来
    expect(today.available).toBe(0)
    // knownWords 与词源无关（个人词库 ∪ 基础词表），收窄的只是候选池
    expect(today.levels.easy.knownWords).toBe(all.levels.easy.knownWords)
  })

  it('should treat all as the default and normalize dirty scopes', async () => {
    const full = await mockReadings.capacity({ targetWords: 100 })
    const dirty = await mockReadings.capacity({
      targetWords: 100,
      vocabScope: ['all', 'today_new'],
    })

    expect(dirty.available).toBe(full.available)
  })

  it('should reject generation when the chosen scope has too few words', async () => {
    await expect(
      mockReadings.generate({
        level: 'easy',
        targetWords: 100,
        questionCount: 3,
        vocabScope: ['today_new'],
      }),
    ).rejects.toMatchObject({ error: { code: 'INSUFFICIENT_VOCABULARY' } })
  })

  it('should report the normalized scope in the failure details', async () => {
    // 600 词要 90 个目标词，全量池子只有 20 个：落进 A 门的 details。
    // 用 hard 而不是 easy——600 已经超过 easy 的 300 上限，会先被篇幅门拦下
    await expect(
      mockReadings.generate({
        level: 'hard',
        targetWords: 600,
        questionCount: 3,
        vocabScope: ['all', 'today_new'],
      }),
    ).rejects.toMatchObject({
      error: { code: 'VOCABULARY_TOO_SMALL', details: { scope: ['all'] } },
    })
  })
})

describe('mockReadings.history', () => {
  it('should compute stats from submitted readings only', async () => {
    const history = await mockReadings.history({ pageSize: 10 })

    expect(history.total).toBe(5)
    expect(history.items[0]).toMatchObject({ id: 'r5', status: 'generated', accuracy: null })
    // 列表只给总量，不拆 prompt / completion（与后端 toHistoryItem 一致）
    expect(history.items[0].tokenUsage).toEqual({ totalTokens: 1550 })
    expect(history.items[1].tokenUsage.totalTokens).toBeGreaterThan(0)
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

describe('mockReadings generation tasks', () => {
  const SETTINGS = { level: 'easy', targetWords: 100, questionCount: 3 }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should walk queued → generating → checking → saving → succeeded', async () => {
    const accepted = await mockReadings.createTask(SETTINGS)

    expect(accepted.taskId).toMatch(/^g\d+$/)
    expect(accepted).toMatchObject({ status: 'queued', stage: 'queued', reused: false })
    expect(accepted.params).toMatchObject({ ...SETTINGS, vocabScope: ['all'] })

    // planning 结束前不报段数，界面据此不画格子
    let dto = await mockReadings.getTask(accepted.taskId)
    expect(dto.progress).toEqual({ done: 0, total: 0 })
    expect(dto.selectedWords).toEqual([])

    await vi.advanceTimersByTimeAsync(600)
    dto = await mockReadings.getTask(accepted.taskId)
    // 100 词按每段 60 词折成 2 段，是真实段数不是百分比
    expect(dto).toMatchObject({ status: 'running', stage: 'generating' })
    expect(dto.progress).toEqual({ done: 0, total: 2 })
    expect(dto.selectedWords.length).toBeGreaterThan(0)

    await vi.advanceTimersByTimeAsync(600)
    dto = await mockReadings.getTask(accepted.taskId)
    expect(dto.stage).toBe('checking')
    expect(dto.progress).toEqual({ done: 2, total: 2 })

    await vi.advanceTimersByTimeAsync(660)
    dto = await mockReadings.getTask(accepted.taskId)
    expect(dto).toMatchObject({ status: 'succeeded', stage: 'done' })
    expect(dto.readingId).toBeTruthy()
    expect(dto.segments).toHaveLength(2)
    expect(dto.durationMs).toBeGreaterThan(0)

    const reading = await mockReadings.get(dto.readingId)
    expect(reading.id).toBe(dto.readingId)
  })

  it('should delay vocabulary gates to the task so the paper can start', async () => {
    const accepted = await mockReadings.createTask({ ...SETTINGS, targetWords: 700, level: 'hard' })

    expect(accepted.status).toBe('queued')

    await vi.advanceTimersByTimeAsync(500)
    const dto = await mockReadings.getTask(accepted.taskId)

    expect(dto.status).toBe('failed')
    expect(dto.retryable).toBe(false)
    expect(dto.error).toMatchObject({
      code: 'INVALID_REQUEST',
      details: { kind: 'final_mode_locked' },
    })
  })

  it('should cancel immediately and keep the task readable', async () => {
    const accepted = await mockReadings.createTask(SETTINGS)
    await vi.advanceTimersByTimeAsync(720)

    const cancelled = await mockReadings.cancelTask(accepted.taskId)

    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.stage).toBe('done')

    const again = await mockReadings.getTask(accepted.taskId)
    expect(again.status).toBe('cancelled')
    expect(again.retryable).toBe(false)
  })

  it('should resume from the written segments on retry', async () => {
    const accepted = await mockReadings.createTask(SETTINGS)
    await vi.advanceTimersByTimeAsync(720)
    await mockReadings.cancelTask(accepted.taskId)

    const retried = await mockReadings.retryTask(accepted.taskId)

    expect(retried).toMatchObject({ taskId: accepted.taskId, status: 'queued', retryCount: 1 })
    expect(retried.reused).toBe(false)

    // 只补剩下的 1 段，再从检查 / 保存走完
    await vi.advanceTimersByTimeAsync(500 + 220 + 400 + 260)
    const dto = await mockReadings.getTask(accepted.taskId)

    expect(dto.status).toBe('succeeded')
    expect(dto.progress).toEqual({ done: 2, total: 2 })
    expect(dto.retryCount).toBe(1)
  })

  it('should reuse a task by client token without starting a second one', async () => {
    const first = await mockReadings.createTask({ ...SETTINGS, clientToken: 'click-1' })
    await vi.advanceTimersByTimeAsync(1600)

    const again = await mockReadings.createTask({ ...SETTINGS, clientToken: 'click-1' })

    expect(again.taskId).toBe(first.taskId)
    expect(again.reused).toBe(true)
    expect(again.status).toBe('succeeded')
  })

  it('should reuse the running task with the same params and 409 on different params', async () => {
    const first = await mockReadings.createTask(SETTINGS)
    const same = await mockReadings.createTask({ ...SETTINGS })
    const other = mockReadings.createTask({ ...SETTINGS, targetWords: 150 })

    expect(same.taskId).toBe(first.taskId)
    expect(same.reused).toBe(true)

    await expect(other).rejects.toMatchObject({
      error: { code: 'TASK_IN_PROGRESS', details: { taskId: first.taskId } },
    })
  })

  it('should validate settings before creating a task', async () => {
    await expect(mockReadings.createTask({ ...SETTINGS, targetWords: 125 })).rejects.toMatchObject({
      error: { code: 'INVALID_REQUEST', field: 'targetWords' },
    })
  })

  it('should return TASK_NOT_FOUND for unknown tasks and after a reset', async () => {
    await expect(mockReadings.getTask('g999')).rejects.toMatchObject({
      error: { code: 'TASK_NOT_FOUND' },
    })

    const { taskId } = await mockReadings.createTask(SETTINGS)
    resetMockDb()

    await expect(mockReadings.getTask(taskId)).rejects.toMatchObject({
      error: { code: 'TASK_NOT_FOUND' },
    })
  })
})
