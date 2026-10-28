/**
 * Mock 后端适配器
 * 用内存 + localStorage 模拟真实接口：延迟、分页、筛选、CRUD、生成、判分与统计。
 * 错误结构与真实后端一致（{ error: { code, message, field } }），切换后端时视图无需改动。
 * 修改写入 localStorage 的 wr.mock.db.v2；调用 resetMockDb() 可恢复初始数据。
 */
import { createSeedDatabase, READING_TEMPLATES } from './seed'
import { localStore, storageKeys } from '../unit/storage'
import { countWords } from '../unit/format'
import {
  firstError,
  isValidWordStatus,
  LEVELS,
  TARGET_WORDS_MAX,
  TARGET_WORDS_MIN,
  TARGET_WORDS_STEP,
  validateSettings,
  validateWordInput,
  VOCABULARY_THRESHOLD,
} from '../unit/validators'

// v3：练习新增 newWords / tokenUsage（视图要用），旧库判为无效并重建，保证本地能看到新 UI
const DB_VERSION = 3
const DEFAULT_LATENCY = 300
const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 10
// 与后端 level-limits.js 保持一致：难度 → 已知词门槛 / 生词预算 / 篇幅上限
const LEVEL_LIMITS = {
  easy: { requiredKnown: 1000, unknownBudget: 0, maxTargetWords: 300 },
  medium: { requiredKnown: 1900, unknownBudget: 3, maxTargetWords: 450 },
  hard: { requiredKnown: 3778, unknownBudget: 5, maxTargetWords: 600 },
}
// 与后端 basic-words.js 保持一致：各档基础词表条数
const BASIC_WORDS_BY_LEVEL = { easy: 600, medium: 1340, hard: 2578 }

let latency = DEFAULT_LATENCY

/** 测试与演示时可覆盖延迟；传 0 关闭延迟 */
export function setMockLatency(value) {
  latency = Math.max(0, Number(value) || 0)
}

export function getMockLatency() {
  return latency
}

/** Mock 接口错误：同时具备 Error 语义与真实接口的错误负载 */
export class MockApiError extends Error {
  constructor(code, message, status = 400, field = '', details = null) {
    super(message)
    this.name = 'MockApiError'
    this.status = status
    // details 与后端一致：只在业务显式给了才出现，没给的错误响应体保持不变
    this.error = { code, message, field, ...(details && { details }) }
  }
}

function createAbortError() {
  if (typeof DOMException !== 'undefined') return new DOMException('生成已取消', 'AbortError')
  const error = new Error('生成已取消')
  error.name = 'AbortError'
  return error
}

function wait(ms, signal) {
  if (signal?.aborted) return Promise.reject(createAbortError())
  if (!ms) return Promise.resolve()

  return new Promise((resolve, reject) => {
    function handleAbort() {
      clearTimeout(timer)
      reject(createAbortError())
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, ms)

    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

function isValidWord(item) {
  return Boolean(
    item &&
    typeof item.word === 'string' &&
    (item.source === 'dictionary' || item.source === 'manual') &&
    Array.isArray(item.senses),
  )
}

function isValidDb(db) {
  return Boolean(
    db &&
    db.version === DB_VERSION &&
    Array.isArray(db.words) &&
    db.words.every(isValidWord) &&
    Array.isArray(db.readings) &&
    Number.isInteger(db.wordSeq) &&
    Number.isInteger(db.readingSeq),
  )
}

function readDb() {
  const stored = localStore.get(storageKeys.mockDb, null)
  if (isValidDb(stored)) return stored

  const fresh = createSeedDatabase()
  localStore.set(storageKeys.mockDb, fresh)
  return fresh
}

function writeDb(db) {
  localStore.set(storageKeys.mockDb, db)
}

/** 恢复初始数据；返回新的数据库对象，便于调用方继续使用 */
export function resetMockDb() {
  const fresh = createSeedDatabase()
  localStore.set(storageKeys.mockDb, fresh)
  return fresh
}

function byNewest(a, b) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

function paginate(items, page, pageSize) {
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE))
  const totalPages = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(Math.max(1, Number(page) || 1), totalPages)
  const start = (current - 1) * size

  return {
    items: items.slice(start, start + size),
    page: current,
    pageSize: size,
    totalPages,
  }
}

/**
 * 列表摘要：取前两条释义拼一行，超长截断。
 * 表格只有一列释义，完整义项留给表单与编辑弹窗。
 */
function buildSummary(senses) {
  const text = (senses || [])
    .map((sense) => String(sense?.meaning ?? '').trim())
    .filter(Boolean)
    .slice(0, 2)
    .join('；')
  return text.length > 30 ? `${text.slice(0, 30)}…` : text
}

function normalizePhonetic(value) {
  if (!value || typeof value !== 'object') return null
  return { uk: String(value.uk ?? ''), us: String(value.us ?? '') }
}

function normalizeSenses(senses) {
  if (!Array.isArray(senses)) return []
  return senses.map((sense) => ({
    pos: String(sense?.pos ?? '').trim(),
    meaning: String(sense?.meaning ?? '').trim(),
  }))
}

function toWordDto(item) {
  return {
    id: item.id,
    word: item.word,
    status: item.status,
    createdAt: item.createdAt,
    source: item.source,
    dictionaryId: item.dictionaryId ?? null,
    phonetic: item.phonetic ? normalizePhonetic(item.phonetic) : null,
    senses: normalizeSenses(item.senses),
    summary: buildSummary(item.senses),
  }
}

/** 每次返回新对象：DTO 里的默认值不能被调用方顺手改掉 */
function emptyTokenUsage() {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
}

/** 可用于生成的词：学习中 / 已掌握；预检与生成共用，避免两处口径漂移 */
function usableWords(words) {
  return words.filter((item) => item.status === 'learning' || item.status === 'mastered')
}

function countWordsByStatus(words) {
  return words.reduce(
    (counts, item) => {
      counts.all += 1
      if (Object.prototype.hasOwnProperty.call(counts, item.status)) counts[item.status] += 1
      return counts
    },
    { all: 0, mastered: 0, learning: 0, new: 0 },
  )
}

/** 判分统一走这里，避免结果页、历史统计与提交响应出现三套计算 */
function scoreReading(reading) {
  const answers = reading.userAnswers || {}
  const results = reading.questions.map((question) => {
    const raw = answers[question.id]
    const selectedOption = raw === undefined ? null : raw
    return {
      questionId: question.id,
      selectedOption,
      correctAnswer: question.correctAnswer,
      isCorrect: selectedOption === question.correctAnswer,
      explanation: question.explanation,
    }
  })
  const correctCount = results.filter((item) => item.isCorrect).length
  const totalQuestions = results.length
  const score = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0

  return { results, correctCount, totalQuestions, score }
}

function toSafeReading(reading) {
  return {
    id: reading.id,
    title: reading.title,
    article: reading.article,
    level: reading.level,
    targetWords: reading.targetWords,
    questionCount: reading.questionCount,
    // 与后端同算法（按空白切分）；老数据缺 newWords / tokenUsage 时给空值，视图据此不渲染
    actualWords: countWords(reading.article),
    newWords: reading.newWords || [],
    tokenUsage: reading.tokenUsage || emptyTokenUsage(),
    createdAt: reading.createdAt,
    status: reading.status,
    questions: reading.questions.map((question) => ({
      id: question.id,
      question: question.question,
      options: [...question.options],
    })),
  }
}

function toFullResult(reading) {
  const { results, correctCount, totalQuestions, score } = scoreReading(reading)

  return {
    id: reading.id,
    title: reading.title,
    article: reading.article,
    level: reading.level,
    targetWords: reading.targetWords,
    questionCount: reading.questionCount,
    actualWords: countWords(reading.article),
    newWords: reading.newWords || [],
    tokenUsage: reading.tokenUsage || emptyTokenUsage(),
    createdAt: reading.createdAt,
    submittedAt: reading.submittedAt,
    status: 'submitted',
    score,
    correctCount,
    totalQuestions,
    accuracy: score,
    translation: reading.translation,
    results,
    vocabulary: [...reading.vocabulary],
    questions: reading.questions.map((question) => ({
      id: question.id,
      question: question.question,
      options: [...question.options],
    })),
  }
}

function toHistoryItem(reading) {
  const isSubmitted = reading.status === 'submitted'
  const summary = isSubmitted ? scoreReading(reading) : null

  return {
    id: reading.id,
    title: reading.title,
    level: reading.level,
    questionCount: reading.questionCount,
    status: reading.status,
    score: summary ? summary.score : null,
    accuracy: summary ? summary.score : null,
    createdAt: reading.createdAt,
    submittedAt: reading.submittedAt,
    // 与后端 toHistoryItem 一致：列表只给总量，不拆 prompt / completion
    tokenUsage: { totalTokens: reading.tokenUsage?.totalTokens ?? 0 },
  }
}

function buildStats(readings) {
  const submitted = readings.filter((item) => item.status === 'submitted')
  let accuracySum = 0
  let bestScore = 0
  let totalWordsRead = 0

  submitted.forEach((reading) => {
    const { score } = scoreReading(reading)
    accuracySum += score
    bestScore = Math.max(bestScore, score)
    totalWordsRead += countWords(reading.article)
  })

  return {
    totalCount: submitted.length,
    averageAccuracy: submitted.length ? Math.round(accuracySum / submitted.length) : 0,
    bestScore,
    totalWordsRead,
  }
}

function normalizeAnswers(reading, answers) {
  if (!Array.isArray(answers)) {
    throw new MockApiError('INVALID_ANSWER', '答案格式不正确', 400)
  }

  const answerMap = new Map()

  answers.forEach((entry) => {
    const questionId = Number(entry?.questionId)
    const question = reading.questions.find((item) => item.id === questionId)

    if (!question) {
      throw new MockApiError('INVALID_ANSWER', '提交的答案包含无效题目', 400)
    }

    const selectedOption = entry?.selectedOption
    if (selectedOption !== null && selectedOption !== undefined) {
      const isValidOption =
        Number.isInteger(selectedOption) &&
        selectedOption >= 0 &&
        selectedOption < question.options.length
      if (!isValidOption) {
        throw new MockApiError('INVALID_ANSWER', '选项超出题目范围', 400)
      }
    }

    answerMap.set(questionId, selectedOption ?? null)
  })

  return Object.fromEntries(answerMap)
}

export const mockWords = {
  async list({ q = '', status = 'all', page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
    await wait(latency)

    const db = readDb()
    const keyword = String(q).trim().toLowerCase()
    const activeStatus = status || 'all'

    const filtered = db.words
      .filter((item) => {
        const matchesStatus = activeStatus === 'all' || item.status === activeStatus
        const matchesKeyword =
          !keyword ||
          item.word.includes(keyword) ||
          (item.senses || []).some((sense) =>
            String(sense?.meaning ?? '')
              .toLowerCase()
              .includes(keyword),
          )
        return matchesStatus && matchesKeyword
      })
      .sort(byNewest)

    const paged = paginate(filtered, page, pageSize)

    return {
      items: paged.items.map(toWordDto),
      total: filtered.length,
      page: paged.page,
      pageSize: paged.pageSize,
      counts: countWordsByStatus(db.words),
    }
  },

  async create(payload = {}) {
    await wait(latency)

    const db = readDb()
    const source = payload.source === 'dictionary' ? 'dictionary' : 'manual'
    const senses = normalizeSenses(payload.senses)
    const { valid, errors, word, meaning } = validateWordInput({
      word: payload.word,
      meaning: payload.meaning,
      mode: source,
      senses,
    })

    if (!valid) {
      const { field, message } = firstError(errors)
      throw new MockApiError('INVALID_REQUEST', message, 400, field)
    }
    if (db.words.some((item) => item.word === word)) {
      throw new MockApiError('WORD_EXISTS', '这个单词已经在词库中了', 409, 'word')
    }

    const status = isValidWordStatus(payload.status) ? payload.status : 'learning'
    const item = {
      id: `w${db.wordSeq}`,
      word,
      status,
      createdAt: new Date().toISOString(),
      source,
      // 词库快照只对命中条目生效；手填条目一律为 null
      dictionaryId: source === 'dictionary' ? (payload.dictionaryId ?? null) : null,
      phonetic: source === 'dictionary' ? normalizePhonetic(payload.phonetic) : null,
      senses: source === 'dictionary' ? senses : meaning ? [{ pos: '', meaning }] : [],
    }

    db.wordSeq += 1
    db.words.push(item)
    writeDb(db)

    return toWordDto(item)
  },

  async update(id, patch = {}) {
    await wait(latency)

    const db = readDb()
    const index = db.words.findIndex((item) => item.id === id)

    if (index === -1) {
      throw new MockApiError('WORD_NOT_FOUND', '这个单词不存在或已被删除', 404)
    }

    const current = db.words[index]
    const isDictionary = current.source === 'dictionary'

    // 词条信息由词库维护：来源、词条 id、音标、义项都不允许经编辑接口改动
    const readonlyField = ['source', 'dictionaryId', 'phonetic', 'senses'].find((field) =>
      Object.prototype.hasOwnProperty.call(patch, field),
    )
    if (readonlyField) {
      throw new MockApiError(
        'READONLY_FIELD',
        '词条信息由词库维护，不能直接修改',
        400,
        readonlyField,
      )
    }
    if (isDictionary && patch.meaning !== undefined) {
      throw new MockApiError('READONLY_FIELD', '词库词条的释义不能修改', 400, 'meaning')
    }

    const { valid, errors, word, meaning } = validateWordInput({
      word: patch.word ?? current.word,
      meaning: patch.meaning ?? current.senses?.[0]?.meaning ?? '',
    })

    if (!valid) {
      const { field, message } = firstError(errors)
      throw new MockApiError('INVALID_REQUEST', message, 400, field)
    }
    if (db.words.some((item, itemIndex) => itemIndex !== index && item.word === word)) {
      throw new MockApiError('WORD_EXISTS', '这个单词已经在词库中了', 409, 'word')
    }
    if (patch.status !== undefined && !isValidWordStatus(patch.status)) {
      throw new MockApiError('INVALID_REQUEST', '学习状态不合法', 400, 'status')
    }

    const updated = {
      ...current,
      word,
      status: patch.status ?? current.status,
      updatedAt: new Date().toISOString(),
    }

    if (word !== current.word && isDictionary) {
      // 换词等于换词条：旧快照不再对应当前词形，整体丢弃并降级为手填
      updated.source = 'manual'
      updated.dictionaryId = null
      updated.phonetic = null
      // 与手填空释义的形态保持一致，列表据此显示占位符
      updated.senses = []
    } else if (!isDictionary) {
      // 手填条目允许改释义
      updated.senses = meaning ? [{ pos: '', meaning }] : []
    }

    db.words[index] = updated
    writeDb(db)

    return toWordDto(updated)
  },

  async remove(id) {
    await wait(latency)

    const db = readDb()
    const index = db.words.findIndex((item) => item.id === id)

    if (index === -1) {
      throw new MockApiError('WORD_NOT_FOUND', '这个单词不存在或已被删除', 404)
    }

    const [removed] = db.words.splice(index, 1)
    writeDb(db)

    // 阅读中的词汇快照是独立数组，删除单词不会影响历史记录
    return { id: removed.id, total: db.words.length }
  },
}

export const mockReadings = {
  /**
   * 生成能力预检
   * 字段与后端 getCapacity 一致，数字是近似值（真实值以后端为准），前端只消费字段形状。
   */
  async capacity(payload = {}, options = {}) {
    await wait(latency, options.signal)

    const targetWords = Number(payload.targetWords)

    if (
      !Number.isInteger(targetWords) ||
      targetWords < TARGET_WORDS_MIN ||
      targetWords > TARGET_WORDS_MAX ||
      targetWords % TARGET_WORDS_STEP !== 0
    ) {
      throw new MockApiError(
        'INVALID_REQUEST',
        `targetWords 必须是 ${TARGET_WORDS_MIN}–${TARGET_WORDS_MAX} 之间 ${TARGET_WORDS_STEP} 的倍数`,
        400,
        'targetWords',
      )
    }

    const db = readDb()
    const available = usableWords(db.words).length
    // 与后端同口径：目标词数 ≈ 篇幅的 15%，至少 1 个
    const required = Math.max(1, Math.round(targetWords * 0.15))
    const levels = {}

    LEVELS.forEach((level) => {
      const limit = LEVEL_LIMITS[level]
      // 近似口径：个人词库 + 该档基础词表；真实值由后端按「去重后并集」计算
      const knownWords = available + BASIC_WORDS_BY_LEVEL[level]

      levels[level] = {
        required,
        sufficient: available >= required,
        shortage: Math.max(0, required - available),
        // 每档各自的候选池（后端 md/22 §3）：mock 不按难度选池，三档同值，
        // 只保证字段形状一致，前端一律读 levels[level].available
        available,
        knownWords,
        requiredKnown: limit.requiredKnown,
        knownSufficient: knownWords >= limit.requiredKnown,
        knownShortage: Math.max(0, limit.requiredKnown - knownWords),
        unknownBudget: limit.unknownBudget,
        maxTargetWords: limit.maxTargetWords,
        targetWordsAllowed: targetWords <= limit.maxTargetWords,
      }
    })

    const target = Math.round(targetWords * 1.1)
    const max = Math.round(targetWords * 1.15)
    const min = Math.round(targetWords * 0.85)

    return {
      targetWords,
      available,
      wordRange: { min: targetWords, target, max, label: `${targetWords}–${max} 词` },
      acceptedRange: { min, target, max, label: `${min}–${max} 词` },
      levels,
    }
  },

  async generate(payload = {}, options = {}) {
    await wait(latency, options.signal)

    const { valid, errors } = validateSettings(payload)
    if (!valid) {
      const { field, message } = firstError(errors)
      throw new MockApiError('INVALID_REQUEST', message, 400, field)
    }

    const { level, targetWords, questionCount } = payload
    const db = readDb()
    const available = usableWords(db.words)

    if (available.length < VOCABULARY_THRESHOLD) {
      throw new MockApiError(
        'INSUFFICIENT_VOCABULARY',
        `当前可用于生成的学习中 / 已掌握单词只有 ${available.length} 个，至少需要 ${VOCABULARY_THRESHOLD} 个。`,
        422,
      )
    }

    // A 门：这次篇幅凑不齐目标词。与后端 vocabularyTooSmall 同口径，
    // 数字用近似值（目标词数 ≈ 篇幅的 15%），前端只消费 details 的字段形状
    const required = Math.max(1, Math.round(targetWords * 0.15))

    if (available.length < required) {
      throw new MockApiError(
        'VOCABULARY_TOO_SMALL',
        `按当前词库，${targetWords} 词的文章还差 ${required - available.length} 个可用词。`,
        422,
        'targetWords',
        {
          kind: 'target_words',
          required,
          available: available.length,
          targetWords,
          scope: ['all'],
          level,
        },
      )
    }

    const templates = READING_TEMPLATES[level] || []
    if (!templates.length) {
      throw new MockApiError('AI_PROVIDER_ERROR', '暂时没有可用的生成模板，请稍后重试。', 502)
    }

    const template = templates[db.readingSeq % templates.length]
    const questions = template.questions.slice(0, questionCount).map((question, index) => ({
      ...question,
      id: index + 1,
    }))

    const reading = {
      id: `r${db.readingSeq}`,
      title: template.title,
      article: template.article,
      translation: template.translation,
      level,
      targetWords,
      questionCount,
      vocabulary: available.slice(0, 10).map((item) => item.word),
      // 模板上带的这两项就是真实后端由 AI 返回、再经 DTO 输出的部分
      newWords: template.newWords || [],
      tokenUsage: template.tokenUsage || emptyTokenUsage(),
      questions,
      status: 'generated',
      userAnswers: null,
      createdAt: new Date().toISOString(),
      submittedAt: null,
    }

    db.readingSeq += 1
    db.readings.unshift(reading)
    writeDb(db)

    return toSafeReading(reading)
  },

  async get(id) {
    await wait(latency)

    const db = readDb()
    const reading = db.readings.find((item) => item.id === id)

    if (!reading) {
      throw new MockApiError('READING_NOT_FOUND', '这篇练习不存在或已被删除', 404)
    }

    return reading.status === 'submitted' ? toFullResult(reading) : toSafeReading(reading)
  },

  async submit(id, answers = []) {
    await wait(latency)

    const db = readDb()
    const index = db.readings.findIndex((item) => item.id === id)

    if (index === -1) {
      throw new MockApiError('READING_NOT_FOUND', '这篇练习不存在或已被删除', 404)
    }

    const reading = db.readings[index]
    if (reading.status === 'submitted') {
      throw new MockApiError('ALREADY_SUBMITTED', '这篇练习已经提交过了', 409)
    }

    const userAnswers = normalizeAnswers(reading, answers)
    const updated = {
      ...reading,
      status: 'submitted',
      userAnswers,
      submittedAt: new Date().toISOString(),
    }

    db.readings[index] = updated
    writeDb(db)

    return toFullResult(updated)
  },

  async history({ level = 'all', page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
    await wait(latency)

    const db = readDb()
    const activeLevel = level || 'all'
    const filtered = db.readings
      .filter((item) => activeLevel === 'all' || item.level === activeLevel)
      .sort(byNewest)
    const paged = paginate(filtered, page, pageSize)

    return {
      items: paged.items.map(toHistoryItem),
      total: filtered.length,
      page: paged.page,
      pageSize: paged.pageSize,
      stats: buildStats(db.readings),
    }
  },
}
