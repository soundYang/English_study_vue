/**
 * Mock 后端适配器
 * 用内存 + localStorage 模拟真实接口：延迟、分页、筛选、CRUD、生成、判分与统计。
 * 错误结构与真实后端一致（{ error: { code, message, field } }），切换后端时视图无需改动。
 * 修改写入 localStorage 的 wr.mock.db.v1；调用 resetMockDb() 可恢复初始数据。
 */
import { createSeedDatabase, READING_TEMPLATES } from './seed'
import { localStore, storageKeys } from '../unit/storage'
import { countWords } from '../unit/format'
import {
  firstError,
  isValidWordStatus,
  validateSettings,
  validateWordInput,
  VOCABULARY_THRESHOLD,
} from '../unit/validators'

const DB_VERSION = 1
const DEFAULT_LATENCY = 300
const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 10

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
  constructor(code, message, status = 400, field = '') {
    super(message)
    this.name = 'MockApiError'
    this.status = status
    this.error = { code, message, field }
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

function isValidDb(db) {
  return Boolean(
    db &&
    db.version === DB_VERSION &&
    Array.isArray(db.words) &&
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

function toWordDto(item) {
  return {
    id: item.id,
    word: item.word,
    meaning: item.meaning,
    status: item.status,
    createdAt: item.createdAt,
  }
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
          (item.meaning || '').toLowerCase().includes(keyword)
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
    const { valid, errors, word, meaning } = validateWordInput(payload)

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
      meaning,
      status,
      createdAt: new Date().toISOString(),
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
    const { valid, errors, word, meaning } = validateWordInput({
      word: patch.word ?? current.word,
      meaning: patch.meaning ?? current.meaning,
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
      meaning,
      status: patch.status ?? current.status,
      updatedAt: new Date().toISOString(),
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
  async generate(payload = {}, options = {}) {
    await wait(latency, options.signal)

    const { valid, errors } = validateSettings(payload)
    if (!valid) {
      const { field, message } = firstError(errors)
      throw new MockApiError('INVALID_REQUEST', message, 400, field)
    }

    const { level, targetWords, questionCount } = payload
    const db = readDb()
    const available = db.words.filter(
      (item) => item.status === 'learning' || item.status === 'mastered',
    )

    if (available.length < VOCABULARY_THRESHOLD) {
      throw new MockApiError(
        'INSUFFICIENT_VOCABULARY',
        `当前可用于生成的学习中 / 已掌握单词只有 ${available.length} 个，至少需要 ${VOCABULARY_THRESHOLD} 个。`,
        422,
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
