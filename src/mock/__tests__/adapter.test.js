/**
 * Mock 适配器测试
 * 覆盖分页筛选、词汇 CRUD 校验、安全 DTO、判分、重复提交、取消生成、历史统计，
 * 以及任务化生成的状态机（建任务 → 轮询 → 取消 / 重试 / 幂等）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mockApiKey,
  mockQuota,
  mockReadings,
  mockWords,
  resetMockDb,
  setMockLatency,
} from '../adapter'
import { storageKeys } from '../../unit/storage'

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
    // studyCounts 按 studyState 分档：种子里 4 个 status='new' 的词都是 9 月的，
    // 早就过了「今天加的」，所以全部落在复习中，新词一档是 0（md/22 第 96 行）
    expect(result.studyCounts).toEqual({
      all: 24,
      new: 0,
      reviewing: 13,
      mastered: 11,
      removed: 0,
    })
  })

  it('should filter by study state', async () => {
    const reviewing = await mockWords.list({ study: 'reviewing', pageSize: 50 })
    const mastered = await mockWords.list({ study: 'mastered', pageSize: 50 })
    const newWords = await mockWords.list({ study: 'new', pageSize: 50 })

    expect(reviewing.items.every((item) => item.studyState === 'reviewing')).toBe(true)
    expect(mastered.items.every((item) => item.studyState === 'mastered')).toBe(true)
    expect(newWords.items).toHaveLength(0)
    expect(reviewing.items.length + mastered.items.length).toBe(24)
  })

  it('should hide tombstones unless asked for them', async () => {
    const db = resetMockDb()
    db.words.push({
      id: 'word_tombstone',
      word: 'tombstone',
      status: 'new',
      source: 'basic-removed',
      senses: [],
      createdAt: '2026-09-05T08:00:00.000Z',
    })
    localStorage.setItem(storageKeys.mockDb, JSON.stringify(db))

    const hidden = await mockWords.list({ pageSize: 50 })
    const shown = await mockWords.list({ includeRemoved: 'true', pageSize: 50 })
    const onlyRemoved = await mockWords.list({ study: 'removed', pageSize: 50 })

    expect(hidden.items.some((item) => item.id === 'word_tombstone')).toBe(false)
    expect(hidden.total).toBe(24)
    expect(shown.items.some((item) => item.id === 'word_tombstone')).toBe(true)
    expect(shown.total).toBe(25)
    expect(onlyRemoved.items.map((item) => item.id)).toEqual(['word_tombstone'])
    // all 不含墓碑；removed 单独一档，徽章写的「不认识」才有地方对得上
    expect(hidden.studyCounts.all).toBe(24)
    expect(shown.studyCounts).toMatchObject({ all: 24, removed: 1 })
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
  it('should merge duplicate words by default and report the action', async () => {
    const created = await mockWords.create({ word: 'Apple', meaning: '苹果', status: 'learning' })

    expect(created).toMatchObject({
      word: 'apple',
      status: 'learning',
      action: 'updated',
      duplicate: true,
    })

    const result = await mockWords.list({ pageSize: 50 })
    expect(result.total).toBe(24)
  })

  it('should keep the original when onDuplicate is skip', async () => {
    const result = await mockWords.create({
      word: 'apple',
      status: 'learning',
      onDuplicate: 'skip',
    })

    expect(result).toMatchObject({
      word: 'apple',
      status: 'mastered',
      action: 'kept',
      duplicate: true,
    })
  })

  it('should still reject duplicates when onDuplicate is error', async () => {
    await expect(
      mockWords.create({ word: 'Apple', meaning: '苹果', onDuplicate: 'error' }),
    ).rejects.toMatchObject({
      error: { code: 'WORD_EXISTS', field: 'word' },
    })
  })

  it('should report kept when the duplicate already has the same status', async () => {
    const result = await mockWords.create({ word: 'apple', status: 'mastered' })

    expect(result).toMatchObject({ action: 'kept', duplicate: true, status: 'mastered' })
  })

  it('should include counts only when requested', async () => {
    const plain = await mockWords.create({ word: 'orchid' })
    const withCounts = await mockWords.create({ word: 'violet', includeCounts: true })

    expect(plain.counts).toBeUndefined()
    expect(plain.studyCounts).toBeUndefined()
    expect(withCounts.counts).toEqual({ all: 26, mastered: 11, learning: 11, new: 4 })
    // 新建的两个词 createdAt 是现在 → studyState='new'，与 status='learning' 分属两套口径
    expect(withCounts.studyCounts).toMatchObject({ all: 26, new: 2, reviewing: 13, mastered: 11 })
    expect(withCounts.total).toBe(26)
  })

  it('should enrich an empty manual entry without pretending it came from the dictionary', async () => {
    await mockWords.create({ word: 'orchid' })
    const enriched = await mockWords.create({ word: 'orchid', meaning: '兰花' })

    expect(enriched).toMatchObject({
      word: 'orchid',
      source: 'manual',
      action: 'enriched',
      duplicate: true,
    })
    expect(enriched.senses[0].meaning).toBe('兰花')
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

describe('mockWords.check', () => {
  it('should report validity, existence, dictionary hit and merge action', async () => {
    const result = await mockWords.check({ words: ['apple', 'orchid', '123'] })
    const [apple, orchid, invalid] = result.items

    expect(apple).toMatchObject({
      valid: true,
      exists: true,
      wordId: 'w1',
      status: 'mastered',
      dictionary: { found: true, id: 'dict_apple', senseCount: 2 },
      // 默认把状态改成 learning，因此已掌握的 apple 会被更新
      action: 'updated',
    })
    expect(orchid).toMatchObject({
      valid: true,
      exists: false,
      dictionary: { found: false },
      action: 'create',
    })
    expect(invalid).toMatchObject({ valid: false, exists: false, action: 'invalid' })
    expect(invalid.reason).toBeTruthy()
    expect(invalid.dictionary).toBeNull()
  })

  it('should report kept when the target status matches', async () => {
    const result = await mockWords.check({ words: ['apple'], status: 'mastered' })

    expect(result.items[0].action).toBe('kept')
  })

  it('should reject empty or oversized batches', async () => {
    await expect(mockWords.check({ words: [] })).rejects.toMatchObject({
      error: { code: 'INVALID_REQUEST', field: 'words' },
    })

    const words = Array.from({ length: 201 }, (_, index) => `word${index}`)
    await expect(mockWords.check({ words })).rejects.toMatchObject({
      error: { code: 'INVALID_REQUEST', field: 'words' },
    })
  })
})

describe('mockWords.batch', () => {
  const TEXT = ['zebra 斑马', 'orchid', 'apple', '# 注释不是单词', '123', 'zebra'].join('\n')

  it('should preview a pasted list without touching the library', async () => {
    const preview = await mockWords.batch({ text: TEXT, dryRun: true })

    expect(preview).toMatchObject({
      dryRun: true,
      wouldCreate: 2,
      wouldUpdate: 1,
      wouldSkip: 1,
      invalid: 1,
    })
    expect(preview.preview.map((item) => [item.word, item.action])).toEqual([
      ['zebra', 'create'],
      ['orchid', 'create'],
      ['apple', 'updated'],
    ])
    // 行号是原始文本下标：123 在第 5 行
    expect(preview.errors[0]).toMatchObject({ index: 4, word: '123' })

    const list = await mockWords.list({ pageSize: 50 })
    expect(list.total).toBe(24)
  })

  it('should create and merge entries, keeping per-item errors', async () => {
    const result = await mockWords.batch({ text: TEXT })

    expect(result).toMatchObject({
      created: 2,
      updated: 1,
      skipped: 1,
      failed: 1,
      total: 5,
    })
    expect(result.items.map((item) => item.word)).toEqual(['zebra', 'orchid', 'apple'])
    expect(result.errors[0]).toMatchObject({ index: 4, word: '123' })
    expect(result.skippedItems).toEqual([
      { index: 5, word: 'zebra', reason: 'DUPLICATE_IN_REQUEST' },
    ])

    const list = await mockWords.list({ pageSize: 50 })
    expect(list.total).toBe(26)
    expect(list.items.find((item) => item.word === 'apple').status).toBe('learning')
    expect(list.items.find((item) => item.word === 'zebra').senses[0].meaning).toBe('斑马')
  })

  it('should honor onDuplicate skip and error for array input', async () => {
    const skipped = await mockWords.batch({
      words: ['apple', 'orchid'],
      onDuplicate: 'skip',
    })
    expect(skipped).toMatchObject({ created: 1, updated: 0, skipped: 1 })

    const rejected = await mockWords.batch({
      words: ['apple'],
      onDuplicate: 'error',
    })
    expect(rejected).toMatchObject({ created: 0, failed: 1 })
    expect(rejected.errors[0].code).toBe('WORD_EXISTS')
  })

  it('should split on explicit separators before the first Chinese character', async () => {
    const preview = await mockWords.batch({
      text: 'abandon - 放弃\norchid　兰花',
      dryRun: true,
    })

    expect(preview.preview.map((item) => item.word)).toEqual(['abandon', 'orchid'])
    expect(preview.wouldCreate).toBe(2)
  })

  it('should reject empty payloads and oversized text', async () => {
    await expect(mockWords.batch({})).rejects.toMatchObject({
      error: { code: 'INVALID_REQUEST', field: 'words' },
    })

    await expect(mockWords.batch({ text: 'a'.repeat(32769) })).rejects.toMatchObject({
      error: { code: 'INVALID_REQUEST', field: 'text' },
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

  it('should reject easy + allowNewWords and non-boolean values', async () => {
    await expect(
      mockReadings.createTask({ ...SETTINGS, allowNewWords: true }),
    ).rejects.toMatchObject({
      error: { code: 'INVALID_REQUEST', field: 'allowNewWords' },
    })

    await expect(
      mockReadings.generate({ ...SETTINGS, allowNewWords: 'yes' }),
    ).rejects.toMatchObject({
      error: { code: 'INVALID_REQUEST', field: 'allowNewWords' },
    })
  })

  it('should keep the allowNewWords tri-state in task params', async () => {
    const params = { ...SETTINGS, level: 'medium', targetWords: 200 }

    const auto = await mockReadings.createTask(params)
    // 自动 = null，不能压成 false：最终模式要靠「没传」判定默认开启（md/42 §3.2）
    expect(auto.params.allowNewWords).toBeNull()
    await mockReadings.cancelTask(auto.taskId)

    const on = await mockReadings.createTask({ ...params, allowNewWords: true })
    expect(on.params.allowNewWords).toBe(true)
    expect((await mockReadings.getTask(on.taskId)).params.allowNewWords).toBe(true)
    await mockReadings.cancelTask(on.taskId)

    const off = await mockReadings.createTask({ ...params, allowNewWords: false })
    expect(off.params.allowNewWords).toBe(false)
  })

  it('should treat a different allowNewWords as different params', async () => {
    const params = { ...SETTINGS, level: 'medium', targetWords: 200 }
    const first = await mockReadings.createTask(params)

    await expect(mockReadings.createTask({ ...params, allowNewWords: true })).rejects.toMatchObject(
      {
        error: { code: 'TASK_IN_PROGRESS', details: { taskId: first.taskId } },
      },
    )
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

describe('mockQuota', () => {
  it('should return a snapshot shaped like GET /api/quota', async () => {
    const snapshot = await mockQuota.get()

    expect(snapshot.day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(snapshot.primary).toMatchObject({ scope: 'device', limit: 3, remaining: 3 })
    expect(snapshot.blocking).toBeNull()
    expect(snapshot.breakdown.map((item) => item.scope)).toEqual(['device', 'network'])
    // 北京时间次日 0 点；至少是一个未来时间，前端可以直接拿来做「何时重置」
    expect(new Date(snapshot.resetAt).getTime()).toBeGreaterThan(Date.now())
  })
})

describe('mockWords.extractImport', () => {
  it('should parse a text file, keep line indexes and mark invalid rows', async () => {
    const file = new File(['apple 苹果\norchid\n123\n# 注释'], 'words.txt', { type: 'text/plain' })

    const data = await mockWords.extractImport(file)

    expect(data).toMatchObject({
      source: 'txt',
      fileName: 'words.txt',
      truncated: false,
      stats: { total: 3, valid: 2, invalid: 1 },
      warnings: [],
    })
    expect(data.rows.map((row) => [row.index, row.word, row.meaning, row.valid])).toEqual([
      [0, 'apple', '苹果', true],
      [1, 'orchid', '', true],
      [2, '123', '', false],
    ])
    expect(data.rows[2].reason).toBeTruthy()
  })

  it('should parse csv with a header, quoted commas and quoted newlines', async () => {
    const csv = ['word,meaning', 'apple,苹果', '"give, up",放弃', 'orchid,"兰\n花"'].join('\n')
    const file = new File([csv], 'words.csv', { type: 'text/csv' })

    const data = await mockWords.extractImport(file)

    expect(data.source).toBe('csv')
    expect(data.stats).toEqual({ total: 3, valid: 2, invalid: 1 })
    // 表头占第 1 行，所以第一条数据从第 2 行开始
    expect(data.rows.map((row) => row.index)).toEqual([1, 2, 3])
    expect(data.rows[0]).toMatchObject({ word: 'apple', meaning: '苹果', valid: true })
    expect(data.rows[1]).toMatchObject({ word: 'give, up', valid: false })
    expect(data.rows[2]).toMatchObject({ word: 'orchid', meaning: '兰\n花', valid: true })
  })

  it('should return NO_TEXT when nothing can be parsed', async () => {
    const data = await mockWords.extractImport(new File([''], 'empty.txt', { type: 'text/plain' }))

    expect(data.rows).toEqual([])
    expect(data.stats).toEqual({ total: 0, valid: 0, invalid: 0 })
    expect(data.warnings[0].code).toBe('NO_TEXT')
  })

  it('should truncate at 500 rows but keep the pre-truncation stats', async () => {
    const text = Array.from({ length: 501 }, () => 'word').join('\n')
    const file = new File([text], 'big.txt', { type: 'text/plain' })

    const data = await mockWords.extractImport(file)

    expect(data.rows).toHaveLength(500)
    expect(data.truncated).toBe(true)
    expect(data.stats).toEqual({ total: 501, valid: 501, invalid: 0 })
  })

  it('should reject oversized files and legacy office formats', async () => {
    await expect(
      mockWords.extractImport({
        name: 'big.txt',
        type: 'text/plain',
        size: 5 * 1024 * 1024 + 1,
        text: async () => '',
      }),
    ).rejects.toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE', field: 'file' } })

    const legacy = new File(['x'], 'legacy.doc', { type: 'application/msword' })
    await expect(mockWords.extractImport(legacy)).rejects.toMatchObject({
      error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: expect.stringContaining('另存为 .docx') },
    })
  })

  it('should require a user API key before AI extraction', async () => {
    const file = new File(['apple'], 'words.txt', { type: 'text/plain' })

    await expect(mockWords.extractImport(file, { mode: 'ai' })).rejects.toMatchObject({
      error: { code: 'USER_API_KEY_REQUIRED' },
    })
  })

  it('should simulate AI meaning fill with the local dictionary', async () => {
    await mockApiKey.save({ provider: 'deepseek', apiKey: `sk-${'a'.repeat(24)}` })

    const data = await mockWords.extractImport(
      new File(['apple\nzzzz'], 'words.txt', { type: 'text/plain' }),
      { mode: 'ai' },
    )

    expect(data.engine).toBe('ai')
    expect(data.ai).toMatchObject({ keySource: 'user', calls: 1 })
    expect(data.rows[0]).toMatchObject({ word: 'apple', meaningSource: 'ai' })
    expect(data.rows[0].meaning).toBeTruthy()
    // 词库里没有的词不伪造释义
    expect(data.rows[1]).toMatchObject({ word: 'zzzz', meaning: '', meaningSource: 'missing' })
    expect(data.warnings.map((warning) => warning.code)).toContain('AI_RECOGNIZED')
  })

  it('should explain that mock mode cannot parse binary or image files', async () => {
    await expect(
      mockWords.extractImport(new File(['x'], 'unit.docx', { type: 'application/octet-stream' })),
    ).rejects.toMatchObject({ error: { code: 'FILE_PARSE_FAILED', field: 'file' } })

    await expect(
      mockWords.extractImport(new File(['x'], 'shot.png', { type: 'image/png' })),
    ).rejects.toMatchObject({ error: { code: 'OCR_FAILED', field: 'file' } })
  })
})
