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
  normalizeVocabScope,
  TARGET_WORDS_MAX,
  TARGET_WORDS_MIN,
  TARGET_WORDS_STEP,
  validateSettings,
  validateWordInput,
  VOCABULARY_THRESHOLD,
} from '../unit/validators'

// v4：单词新增 cocaRank（词频徽标要用）；v3 起练习带 newWords / tokenUsage。
// 旧库判为无效并重建，保证本地能看到新 UI
const DB_VERSION = 4
const DEFAULT_LATENCY = 300
const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 10
// 与后端 level-limits.js 保持一致：难度 → 生词预算 / 篇幅上限。
// 原来的 requiredKnown（1000 / 1900 / 3778）已在 md/30 §7 删除，
// 篇幅门槛改由 minKnownFor 按篇幅现算，见下面的 mockMinKnown
const LEVEL_LIMITS = {
  easy: { unknownBudget: 0, maxTargetWords: 300 },
  medium: { unknownBudget: 3, maxTargetWords: 450 },
  hard: { unknownBudget: 5, maxTargetWords: 600 },
}
// 已知词地板：600 个基础词 ∪ 19 个日历词 − 1 个重合（may）。
// 真实值由后端按实际词表求并集现算；mock 没有那份表，用近似常量
const KNOWN_FLOOR = 618
// 最终模式：个人词库 3000 解锁，只有 hard 能写到 1000（md/30 §2.2）
const FINAL_MODE_PERSONAL_WORDS = 3000
const FINAL_MODE_MAX_WORDS = 1000
const LENGTH_STEP = 100
// hard 的实测下限（md/27 §4.6–§4.8）；easy / medium 没有采样，只走 A 门折算
const HARD_MEASURED_MIN_KNOWN = { 100: 638, 200: 647, 300: 661, 400: 676, 500: 690, 600: 704 }
// 用户反馈（md/37 §5.1）：与后端 zod schema 同一口径，本地实现只用于无后端时演示
const FEEDBACK_CONTENT_MIN = 10
const FEEDBACK_CONTENT_MAX = 2000
const FEEDBACK_FIELD_MAX = 100
const FEEDBACK_CATEGORIES = ['bug', 'feature', 'content', 'data', 'privacy', 'other']

/** 写 targetWords 词至少要认识多少词；与后端 capacity-table.js 的 minKnownFor 同构 */
function mockMinKnown(targetWords, level) {
  const n = Math.max(1, Math.round(Number(targetWords) || 0))

  if (n > LEVEL_LIMITS.hard.maxTargetWords) {
    // easy / medium 写不到 601+，按本档上限报，免得让人以为攒够词就能用 easy 写 1000
    if (level !== 'hard') return mockMinKnown(LEVEL_LIMITS[level]?.maxTargetWords || 300, level)
    return KNOWN_FLOOR + FINAL_MODE_PERSONAL_WORDS
  }

  // A 门折算值的近似：mock 不区分难度的池比例，统一按篇幅的 15% 估
  const byGate = KNOWN_FLOOR + Math.max(1, Math.round(n * 0.15))

  if (level !== 'hard') return byGate

  const keys = Object.keys(HARD_MEASURED_MIN_KNOWN)
    .map(Number)
    .sort((left, right) => left - right)
  let measured = HARD_MEASURED_MIN_KNOWN[keys[0]]
  for (const key of keys) {
    if (key <= n) measured = HARD_MEASURED_MIN_KNOWN[key]
  }

  return Math.max(measured, byGate)
}

/** /capacity 的篇幅阶梯：100–1000 每 100 一行，blockedBy 口径与后端一致 */
function mockLengthLadder({ level, knownWords, personalWords }) {
  const hardCap = LEVEL_LIMITS.hard.maxTargetWords
  const finalModeUnlocked = personalWords >= FINAL_MODE_PERSONAL_WORDS
  const levelCap =
    level === 'hard' && finalModeUnlocked
      ? FINAL_MODE_MAX_WORDS
      : LEVEL_LIMITS[level].maxTargetWords
  const ladder = []

  for (
    let targetWords = LENGTH_STEP;
    targetWords <= FINAL_MODE_MAX_WORDS;
    targetWords += LENGTH_STEP
  ) {
    const minKnown = mockMinKnown(targetWords, level)
    const knownOk = knownWords >= minKnown
    const beyondFinalMode = level === 'hard' && targetWords > hardCap

    let blockedBy = null
    if (targetWords > levelCap) {
      blockedBy = beyondFinalMode && !finalModeUnlocked ? 'final_mode' : 'level_cap'
    } else if (!knownOk) {
      blockedBy = 'known_words'
    }

    const shortage =
      blockedBy === 'final_mode'
        ? Math.max(0, FINAL_MODE_PERSONAL_WORDS - personalWords)
        : blockedBy === 'known_words'
          ? Math.max(0, minKnown - knownWords)
          : 0

    ladder.push({
      targetWords,
      minKnown,
      unlocked: blockedBy === null,
      blockedBy,
      shortage,
      finalMode: beyondFinalMode,
    })
  }

  return ladder
}

let latency = DEFAULT_LATENCY

/** 内存里的生成任务；刷新页面即丢，真实后端有 24h TTL，mock 只模拟状态机 */
const generationTasks = new Map()
let generationTaskSeq = 0

// 任务节奏：600 词约 4s，够看清「逐段点亮 → 校对 → 保存」；真实后端 40–90s
const TASK_TTL_MS = 24 * 60 * 60 * 1000
const TASK_PLANNING_MS = 500
const TASK_SEGMENT_MS = 220
const TASK_CHECKING_MS = 400
const TASK_SAVING_MS = 260
const TASK_SEGMENT_WORDS = 60
// 参数错、词不够时重试只会再失败一次：retryable=false（后端 md/32 §9）
const TASK_NOT_RETRYABLE = ['INSUFFICIENT_VOCABULARY', 'VOCABULARY_TOO_SMALL', 'INVALID_REQUEST']

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
  generationTasks.clear()
  generationTaskSeq = 0
  // 资料与阅读库分开存，重置种子数据时也要一起回到默认昵称
  localStore.remove(storageKeys.mockProfile)
  // 账号与会话一并回到演示账号，避免重置后还停在某个已注册账号上
  localStore.remove(storageKeys.mockAuthSession)
  localStore.remove(storageKeys.mockAuthUsers)
  mockCaptchas.clear()
  loginFailures.clear()
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
    // 手填词没有词库名次：null 而不是 0（0 会被当成「第 0 名」= 最高频）
    cocaRank: item.cocaRank ?? null,
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

function isSameLocalDay(value, now) {
  if (!value) return false

  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.toDateString() === now.toDateString()
}

/**
 * 按词源过滤：多来源取并集，'all' 直接全量（同后端 vocabulary-pool.js filterByScope）。
 * 「今天复习」依赖 lastReviewedAt，而它只在提交练习时回写，所以刚加的词只能被「今天新学」选中。
 */
function filterByScope(words, scopes, now = new Date()) {
  if (scopes.includes('all')) return words

  return words.filter(
    (item) =>
      (scopes.includes('today_new') && isSameLocalDay(item.createdAt, now)) ||
      (scopes.includes('today_reviewed') && isSameLocalDay(item.lastReviewedAt, now)),
  )
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

const NICKNAME_MAX = 20
const SIGNATURE_MAX = 60
const PASSWORD_MIN = 8
const PASSWORD_MAX = 64
const WEEKLY_BUCKETS = 12

// 未注册时的本地用户：昵称对应设计稿的 Sound，username 保留历史 dataKey 的展示值。
// 真实后端在 AUTH_ENFORCED=false 时也应以同一形状回一个默认用户（md/33 §7.3）
const DEFAULT_PROFILE = Object.freeze({
  id: 'local-user',
  username: 'local-user',
  nickname: 'Sound',
  signature: '少年，大胆走，怎么都是路。',
  phone: null,
  createdAt: '2026-09-01T08:00:00.000Z',
})

function readProfile() {
  // 登录后个人中心属于当前账号；没登录时沿用 local-user，保持 mock 单机体验不变
  const active = activeMockUser()
  if (active) {
    return {
      ...DEFAULT_PROFILE,
      ...active,
      nickname: String(active.nickname || active.username),
      signature: String(active.signature ?? ''),
    }
  }

  const stored = localStore.get(storageKeys.mockProfile, null)
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_PROFILE }

  return {
    ...DEFAULT_PROFILE,
    ...stored,
    nickname: String(stored.nickname ?? DEFAULT_PROFILE.nickname),
    signature: String(stored.signature ?? ''),
  }
}

function writeProfile(profile) {
  const active = activeMockUser()
  if (active) {
    const users = readMockUsers().map((user) =>
      user.id === active.id
        ? { ...user, nickname: profile.nickname, signature: profile.signature }
        : user,
    )
    writeMockUsers(users)
    return
  }

  localStore.set(storageKeys.mockProfile, profile)
}

/** 与后端同形状：不返回 dataKey / passwordHash / usernameLower（md/33 §6.2） */
function toProfileUser(profile) {
  return {
    id: profile.id,
    username: profile.username,
    nickname: profile.nickname,
    signature: profile.signature,
    phone: profile.phone,
    createdAt: profile.createdAt,
  }
}

// ——— Mock 鉴权（md/33 §3–§6） ———
// 真实后端的规则全部照搬：用户名 3–20 位字母数字下划线、密码 8–64 位且含字母与数字、
// 图形验证码一次性、登录失败 5 次后必须带验证码。只把「库」换成 localStorage。

const AUTH_USERNAME_MIN = 3
const AUTH_USERNAME_MAX = 20
const AUTH_USERNAME_PATTERN = /^[A-Za-z0-9_]+$/
const AUTH_PHONE_PATTERN = /^1[3-9]\d{9}$/
const CAPTCHA_TTL_SECONDS = 300
const LOGIN_FAILURE_LIMIT = 5
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000
// 去掉 I / O / 0 / 1 等易混字符，跟后端 captcha.js 的取字思路一致
const CAPTCHA_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SESSION_TTL_MS = Object.freeze({
  standard: 24 * 60 * 60 * 1000,
  remember: 30 * 24 * 60 * 60 * 1000,
})

// 演示账号：mock 登录页会显示这组账号。首个注册的账号同样会占用 local-user（md/33 §8）
const DEMO_ACCOUNT = Object.freeze({
  id: 'local-user',
  username: 'Sound',
  usernameLower: 'sound',
  password: 'sound1234',
  nickname: 'Sound',
  signature: '少年，大胆走，怎么都是路。',
  phone: null,
  dataKey: 'local-user',
  createdAt: '2026-09-01T08:00:00.000Z',
})

/** 登录页的演示提示只读这一份，避免页面和 mock 两处硬编码 */
export const MOCK_DEMO_CREDENTIALS = Object.freeze({
  username: DEMO_ACCOUNT.username,
  password: DEMO_ACCOUNT.password,
})

const mockCaptchas = new Map()
const loginFailures = new Map()

function randomToken() {
  return `${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`
}

function readMockUsers() {
  const stored = localStore.get(storageKeys.mockAuthUsers, null)
  if (Array.isArray(stored) && stored.length > 0) return stored

  const seeded = [{ ...DEMO_ACCOUNT }]
  localStore.set(storageKeys.mockAuthUsers, seeded)
  return seeded
}

function writeMockUsers(users) {
  localStore.set(storageKeys.mockAuthUsers, users)
}

function readMockSession() {
  const stored = localStore.get(storageKeys.mockAuthSession, null)
  if (!stored || typeof stored !== 'object') return null

  if (Number(stored.expiresAt) <= Date.now()) {
    localStore.remove(storageKeys.mockAuthSession)
    return null
  }
  return stored
}

/** 当前登录的 mock 用户；没登录时返回 null，个人中心回落到默认的 local-user */
function activeMockUser() {
  const session = readMockSession()
  if (!session) return null

  return readMockUsers().find((user) => user.id === session.userId) || null
}

function saveMockSession(user, rememberMe) {
  const ttl = rememberMe ? SESSION_TTL_MS.remember : SESSION_TTL_MS.standard
  const expiresAt = Date.now() + ttl
  const token = `mock_sess_${randomToken()}`

  localStore.set(storageKeys.mockAuthSession, { token, userId: user.id, expiresAt })
  return { token, expiresAt: new Date(expiresAt).toISOString() }
}

function clearMockSession() {
  localStore.remove(storageKeys.mockAuthSession)
}

function buildCaptchaSvg(code) {
  const chars = code
    .split('')
    .map((char, index) => {
      const x = 16 + index * 24
      const rotate = (index % 2 ? 1 : -1) * (6 + index * 2)
      return `<text x="${x}" y="27" font-family="Georgia, serif" font-size="22" fill="#3d4a3f" transform="rotate(${rotate} ${x + 6} 22)">${char}</text>`
    })
    .join('')

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">',
    '<rect width="120" height="40" rx="8" fill="#f4efe3"/>',
    '<path d="M6 30 Q30 12 54 26 T102 18" fill="none" stroke="#c3cdbd" stroke-width="1"/>',
    '<path d="M10 12 Q40 28 86 10" fill="none" stroke="#d8cbb2" stroke-width="1"/>',
    chars,
    '</svg>',
  ].join('')
}

function verifyMockCaptcha(captchaId, answer) {
  const record = mockCaptchas.get(captchaId)
  // 一次性：不管对错，取出来就作废（后端 findOneAndDelete，md/33 §5.3）
  mockCaptchas.delete(captchaId)

  if (!record || record.expiresAt <= Date.now()) {
    throw new MockApiError('CAPTCHA_EXPIRED', '验证码已过期，请换一张', 400, 'captchaCode')
  }
  if (
    record.code.toLowerCase() !==
    String(answer ?? '')
      .trim()
      .toLowerCase()
  ) {
    throw new MockApiError('CAPTCHA_INVALID', '验证码不对，请重新输入', 400, 'captchaCode')
  }
}

function assertPasswordRule(value, field = 'password') {
  const password = String(value ?? '')
  if (password.length < PASSWORD_MIN) {
    throw new MockApiError('INVALID_REQUEST', `密码至少 ${PASSWORD_MIN} 位`, 400, field)
  }
  if (password.length > PASSWORD_MAX) {
    throw new MockApiError('INVALID_REQUEST', `密码最多 ${PASSWORD_MAX} 位`, 400, field)
  }
  if (!/[A-Za-z]/.test(password)) {
    throw new MockApiError('INVALID_REQUEST', '密码需要包含字母', 400, field)
  }
  if (!/\d/.test(password)) {
    throw new MockApiError('INVALID_REQUEST', '密码需要包含数字', 400, field)
  }
}

function recordLoginFailure(key) {
  const now = Date.now()
  const entry = loginFailures.get(key)

  if (!entry || now - entry.firstAt > LOGIN_FAILURE_WINDOW_MS) {
    loginFailures.set(key, { count: 1, firstAt: now })
    return
  }
  entry.count += 1
}

function requiresCaptcha(key) {
  const entry = loginFailures.get(key)
  if (!entry) return false
  if (Date.now() - entry.firstAt > LOGIN_FAILURE_WINDOW_MS) {
    loginFailures.delete(key)
    return false
  }
  return entry.count >= LOGIN_FAILURE_LIMIT
}

/** 周一作为一周起点，与后端 weekly.weekStart 的口径一致 */
function startOfWeek(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value ?? Date.now())
  if (Number.isNaN(date.getTime())) return null

  date.setHours(0, 0, 0, 0)
  // getDay() 周日为 0；换算成周一为 0 的偏移
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return date
}

function formatLocalDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** 近 12 周：无数据的周补 0，数组长度固定，前端柱状图才能画出固定格子（md/33 §9.3） */
function buildWeeklyBuckets(readings, now = new Date()) {
  const currentWeek = startOfWeek(now)
  const buckets = []

  for (let offset = WEEKLY_BUCKETS - 1; offset >= 0; offset -= 1) {
    const start = new Date(currentWeek)
    start.setDate(start.getDate() - offset * 7)
    buckets.push({ start, count: 0 })
  }

  readings
    .filter((item) => item.status === 'submitted')
    .forEach((item) => {
      const week = startOfWeek(item.submittedAt || item.createdAt)
      if (!week) return

      const bucket = buckets.find((entry) => entry.start.getTime() === week.getTime())
      if (bucket) bucket.count += 1
    })

  return buckets.map((bucket) => ({
    weekStart: formatLocalDate(bucket.start),
    count: bucket.count,
  }))
}

/**
 * 个人中心统计（md/33 §9）
 * 准确率按题算，不是各篇得分的平均；token 包含未提交的稿子——钱花在生成上。
 */
function buildProfileStats(readings, now = new Date()) {
  const submitted = readings.filter((item) => item.status === 'submitted')
  let answered = 0
  let correct = 0
  let totalTokens = 0

  readings.forEach((reading) => {
    totalTokens += Number(reading.tokenUsage?.totalTokens) || 0
  })

  submitted.forEach((reading) => {
    answered += reading.questions.length
    correct += scoreReading(reading).correctCount
  })

  return {
    reading: {
      completedCount: submitted.length,
      generatedCount: readings.length,
      totalTokens,
    },
    questions: {
      answered,
      correct,
      wrong: answered - correct,
      accuracy: answered ? Math.round((correct / answered) * 100) : 0,
    },
    weekly: buildWeeklyBuckets(readings, now),
  }
}

/**
 * 个人中心接口的本地实现
 * 资料单独存一个键，避免为了改昵称把整套种子阅读库重建（DB_VERSION 不用动）。
 */
export const mockProfile = {
  async get() {
    await wait(latency)
    return { user: toProfileUser(readProfile()) }
  },

  async update(patch = {}) {
    await wait(latency)

    const profile = readProfile()
    const next = { ...profile }

    if (patch.nickname !== undefined) {
      const nickname = String(patch.nickname ?? '').trim()
      if (!nickname) {
        throw new MockApiError('INVALID_REQUEST', '昵称不能为空', 400, 'nickname')
      }
      if (nickname.length > NICKNAME_MAX) {
        throw new MockApiError(
          'INVALID_REQUEST',
          `昵称最多 ${NICKNAME_MAX} 个字符`,
          400,
          'nickname',
        )
      }
      next.nickname = nickname
    }

    if (patch.signature !== undefined) {
      const signature = String(patch.signature ?? '').trim()
      if (signature.length > SIGNATURE_MAX) {
        throw new MockApiError(
          'INVALID_REQUEST',
          `个性签名最多 ${SIGNATURE_MAX} 个字符`,
          400,
          'signature',
        )
      }
      next.signature = signature
    }

    writeProfile(next)
    return { user: toProfileUser(next) }
  },

  async changePassword({ oldPassword = '', newPassword = '' } = {}) {
    await wait(latency)

    const previous = String(oldPassword)
    const next = String(newPassword)
    if (!previous) {
      throw new MockApiError('INVALID_REQUEST', '请输入当前密码', 400, 'oldPassword')
    }
    assertPasswordRule(next, 'newPassword')
    if (next === previous) {
      throw new MockApiError('INVALID_REQUEST', '新密码不能与当前密码相同', 400, 'newPassword')
    }

    // 有会话时按真实后端校验旧密码并落盘；没登录的老 local-user 没有密码可对，
    // 只校验表单规则（历史行为，避免 mock 旧数据突然改不了密码）
    const active = activeMockUser()
    if (active) {
      if (previous !== active.password) {
        throw new MockApiError('INVALID_REQUEST', '当前密码不正确', 400, 'oldPassword')
      }

      const users = readMockUsers().map((user) =>
        user.id === active.id ? { ...user, password: next } : user,
      )
      writeMockUsers(users)
      // 真实后端会踢掉其它会话，mock 只有一个会话；这里不额外处理（md/33 §4.4）
    }

    return { ok: true }
  },

  async stats() {
    await wait(latency)
    return buildProfileStats(readDb().readings)
  },
}

/**
 * 用户反馈接口的本地实现（md/37 §5.1）
 * 只做校验并回 201，不落库——本地开发不需要回看自己提交过什么。
 * 错误结构（code / field / details）与真实后端一致，方便切换后直接对照。
 */
export const mockFeedback = {
  async submit({ category = 'other', content = '', contact = '', page = '' } = {}) {
    await wait(latency)

    if (!FEEDBACK_CATEGORIES.includes(category)) {
      throw new MockApiError('INVALID_REQUEST', '反馈类型不合法', 400, 'category')
    }

    const text = String(content ?? '').trim()
    if (text.length < FEEDBACK_CONTENT_MIN) {
      throw new MockApiError(
        'FEEDBACK_TOO_SHORT',
        `反馈内容至少 ${FEEDBACK_CONTENT_MIN} 个字`,
        400,
        'content',
        { minLength: FEEDBACK_CONTENT_MIN, maxLength: FEEDBACK_CONTENT_MAX },
      )
    }
    if (text.length > FEEDBACK_CONTENT_MAX) {
      throw new MockApiError(
        'FEEDBACK_TOO_LONG',
        `反馈内容最多 ${FEEDBACK_CONTENT_MAX} 个字`,
        400,
        'content',
        { minLength: FEEDBACK_CONTENT_MIN, maxLength: FEEDBACK_CONTENT_MAX },
      )
    }

    const contactText = String(contact ?? '').trim()
    if (contactText.length > FEEDBACK_FIELD_MAX) {
      throw new MockApiError(
        'INVALID_REQUEST',
        `联系方式最多 ${FEEDBACK_FIELD_MAX} 个字`,
        400,
        'contact',
      )
    }

    const pageText = String(page ?? '').trim()
    if (pageText.length > FEEDBACK_FIELD_MAX) {
      throw new MockApiError(
        'INVALID_REQUEST',
        `页面地址最多 ${FEEDBACK_FIELD_MAX} 个字`,
        400,
        'page',
      )
    }

    return {
      id: `fb_${Date.now().toString(36)}`,
      status: 'open',
      createdAt: new Date().toISOString(),
    }
  },
}

/**
 * 注册 / 登录 / 退出 / 验证码的本地实现（md/33 §6）
 * 只存 `password` 明文用于本地比对——mock 没有安全边界，真实后端存 scrypt hash。
 */
export const mockAuth = {
  async captcha() {
    await wait(latency)

    const code = Array.from(
      { length: 4 },
      () => CAPTCHA_ALPHABET[Math.floor(Math.random() * CAPTCHA_ALPHABET.length)],
    ).join('')
    const captchaId = `mock_${randomToken()}`
    mockCaptchas.set(captchaId, {
      code,
      expiresAt: Date.now() + CAPTCHA_TTL_SECONDS * 1000,
    })

    return { captchaId, svg: buildCaptchaSvg(code), expiresIn: CAPTCHA_TTL_SECONDS }
  },

  async register(payload = {}) {
    await wait(latency)

    const username = String(payload.username ?? '').trim()
    if (!username) {
      throw new MockApiError('INVALID_REQUEST', '请输入用户名', 400, 'username')
    }
    if (username.length < AUTH_USERNAME_MIN) {
      throw new MockApiError(
        'INVALID_REQUEST',
        `用户名至少 ${AUTH_USERNAME_MIN} 个字符`,
        400,
        'username',
      )
    }
    if (username.length > AUTH_USERNAME_MAX) {
      throw new MockApiError(
        'INVALID_REQUEST',
        `用户名最多 ${AUTH_USERNAME_MAX} 个字符`,
        400,
        'username',
      )
    }
    if (!AUTH_USERNAME_PATTERN.test(username)) {
      throw new MockApiError('INVALID_REQUEST', '用户名只能包含字母、数字和下划线', 400, 'username')
    }

    assertPasswordRule(payload.password, 'password')

    const rawPhone = String(payload.phone ?? '').trim()
    if (rawPhone && !AUTH_PHONE_PATTERN.test(rawPhone)) {
      throw new MockApiError('INVALID_REQUEST', '手机号格式不正确', 400, 'phone')
    }

    const captchaId = String(payload.captchaId ?? '')
    const captchaCode = String(payload.captchaCode ?? '')
    if (!captchaId || !captchaCode) {
      throw new MockApiError('INVALID_REQUEST', '请输入图形验证码', 400, 'captchaCode')
    }
    // 先消耗验证码再查重，与后端顺序一致：否则不用解题就能问出用户名是否被占用
    verifyMockCaptcha(captchaId, captchaCode)

    const users = readMockUsers()
    const usernameLower = username.toLowerCase()
    if (users.some((user) => user.usernameLower === usernameLower)) {
      throw new MockApiError('AUTH_USERNAME_TAKEN', '这个用户名已经被使用了', 409, 'username')
    }
    if (rawPhone && users.some((user) => user.phone === rawPhone)) {
      throw new MockApiError('AUTH_PHONE_TAKEN', '这个手机号已经注册过了', 409, 'phone')
    }

    const id = `u_${randomToken()}`
    const user = {
      id,
      username,
      usernameLower,
      password: String(payload.password),
      nickname: username,
      signature: '',
      phone: rawPhone || null,
      dataKey: id,
      createdAt: new Date().toISOString(),
    }
    writeMockUsers([...users, user])

    // 注册成功即登录，与后端一致；注册不勾「记住账号」，固定 1 天
    const session = saveMockSession(user, false)
    return { ...session, user: toProfileUser(user) }
  },

  async login(payload = {}) {
    await wait(latency)

    const identifier = String(payload.usernameOrPhone ?? '').trim()
    if (!identifier) {
      throw new MockApiError('INVALID_REQUEST', '请输入用户名或手机号', 400, 'usernameOrPhone')
    }
    const password = String(payload.password ?? '')
    if (!password) {
      throw new MockApiError('INVALID_REQUEST', '请输入密码', 400, 'password')
    }

    const key = identifier.toLowerCase()
    if (requiresCaptcha(key)) {
      if (!payload.captchaId || !payload.captchaCode) {
        throw new MockApiError(
          'CAPTCHA_REQUIRED',
          '登录失败次数较多，请输入图形验证码后重试',
          400,
          'captchaCode',
        )
      }
      verifyMockCaptcha(payload.captchaId, payload.captchaCode)
    }

    const user = readMockUsers().find(
      (item) => item.usernameLower === key || (item.phone && item.phone === identifier),
    )
    // 用户不存在与密码错一律同一个 code，不暴露账号是否存在（md/33 §10）
    if (!user || user.password !== password) {
      recordLoginFailure(key)
      throw new MockApiError('AUTH_INVALID_CREDENTIALS', '用户名或密码不正确', 401, 'password')
    }

    loginFailures.delete(key)
    const session = saveMockSession(user, payload.rememberMe === true)
    return { ...session, user: toProfileUser(user) }
  },

  async logout() {
    await wait(latency)
    clearMockSession()
    return { ok: true }
  },

  /** 只给测试与本地调试：读出验证码答案，真实后端永远不会返回 */
  peekCaptchaCode(captchaId) {
    return mockCaptchas.get(captchaId)?.code || ''
  },

  /** 当前登录用户；没有会话时返回 null */
  currentUser() {
    const active = activeMockUser()
    return active ? toProfileUser(active) : null
  },
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
      cocaRank: source === 'dictionary' ? (payload.cocaRank ?? null) : null,
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
    const readonlyField = ['source', 'dictionaryId', 'phonetic', 'senses', 'cocaRank'].find(
      (field) => Object.prototype.hasOwnProperty.call(patch, field),
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
      // 词频跟着词条走：不再对应词库后就没有名次可查
      updated.cocaRank = null
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

/**
 * 生成前的三道闸门（与后端同口径）
 * 同步接口直接抛错；任务接口把错误存进任务，planning 结束后以 failed 呈现——
 * 建任务时已经回过 202，后台失败没有 HTTP 响应可写（后端 md/31 §3.1）。
 */
function evaluateGenerationGates(payload, db) {
  const { level, targetWords } = payload
  const scope = normalizeVocabScope(payload.vocabScope)
  const available = filterByScope(usableWords(db.words), scope)
  const personalWords = usableWords(db.words).length
  // 与后端同口径：600 是 hard 的常规上限，601+ 要么已解锁最终模式，要么 400
  const levelCap = LEVEL_LIMITS[level]?.maxTargetWords ?? TARGET_WORDS_MAX
  const finalModeActivated =
    level === 'hard' && targetWords > levelCap && personalWords >= FINAL_MODE_PERSONAL_WORDS

  if (targetWords > levelCap && !finalModeActivated) {
    if (level === 'hard') {
      const shortage = Math.max(0, FINAL_MODE_PERSONAL_WORDS - personalWords)

      return {
        error: new MockApiError(
          'INVALID_REQUEST',
          `写 ${targetWords} 词的长文属于「最终模式」，需要个人词库里有 ${FINAL_MODE_PERSONAL_WORDS} 个单词才能解锁，当前有 ${personalWords} 个（还差 ${shortage} 个）。请缩短篇幅，或继续添加单词。`,
          400,
          'targetWords',
          {
            kind: 'final_mode_locked',
            targetWords,
            metric: 'personal_words',
            unlockAt: FINAL_MODE_PERSONAL_WORDS,
            available: personalWords,
            shortage,
          },
        ),
        available,
      }
    }

    return {
      error: new MockApiError(
        'INVALID_REQUEST',
        `当前难度最多写 ${levelCap} 词，请缩短篇幅或提高难度。`,
        400,
        'targetWords',
        {
          kind: 'target_words_cap',
          level,
          targetWords,
          maxTargetWords: levelCap,
          finalModeUnlocked: false,
        },
      ),
      available,
    }
  }

  if (available.length < VOCABULARY_THRESHOLD) {
    return {
      error: new MockApiError(
        'INSUFFICIENT_VOCABULARY',
        `当前可用于生成的学习中 / 已掌握单词只有 ${available.length} 个，至少需要 ${VOCABULARY_THRESHOLD} 个。`,
        422,
      ),
      available,
    }
  }

  // A 门：这次篇幅凑不齐目标词。与后端 vocabularyTooSmall 同口径，
  // 数字用近似值（目标词数 ≈ 篇幅的 15%），前端只消费 details 的字段形状。
  // 最终模式不挑目标词，跳过这道门（后端 freeForm 同一取舍，md/30 §7.4）
  const required = Math.max(1, Math.round(targetWords * 0.15))

  if (!finalModeActivated && available.length < required) {
    return {
      error: new MockApiError(
        'VOCABULARY_TOO_SMALL',
        `按当前词库，${targetWords} 词的文章还差 ${required - available.length} 个可用词。`,
        422,
        'targetWords',
        {
          kind: 'target_words',
          required,
          available: available.length,
          targetWords,
          scope,
          level,
        },
      ),
      available,
    }
  }

  return { error: null, available }
}

/** 按模板生成一篇阅读并落库；同步接口与任务成功共用 */
function createReadingRecord(db, payload, available) {
  const templates = READING_TEMPLATES[payload.level] || []
  if (!templates.length) {
    throw new MockApiError('AI_PROVIDER_ERROR', '暂时没有可用的生成模板，请稍后重试。', 502)
  }

  const template = templates[db.readingSeq % templates.length]
  const questions = template.questions.slice(0, payload.questionCount).map((question, index) => ({
    ...question,
    id: index + 1,
  }))

  const reading = {
    id: `r${db.readingSeq}`,
    title: template.title,
    article: template.article,
    translation: template.translation,
    level: payload.level,
    targetWords: payload.targetWords,
    questionCount: payload.questionCount,
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

  return reading
}

/** 规划一结束就能给前端的本次抽词（后端 md/31 §3.2） */
function buildSelectedWords(available) {
  return available.slice(0, 10).map((item, index) => ({
    word: item.word,
    kind: index < 2 ? 'focus' : 'target',
    phonetic: item.phonetic ? normalizePhonetic(item.phonetic) : { uk: '', us: '' },
    senses: normalizeSenses(item.senses),
  }))
}

function normalizeScopeList(scope) {
  return [...normalizeVocabScope(scope)].sort().join(',')
}

function sameTaskParams(left, right) {
  return (
    left.level === right.level &&
    Number(left.targetWords) === Number(right.targetWords) &&
    Number(left.questionCount) === Number(right.questionCount) &&
    normalizeScopeList(left.vocabScope) === normalizeScopeList(right.vocabScope) &&
    // 三态比较：null（自动）与显式 true / false 是三种不同参数（后端 md/42 §3.2）
    (left.allowNewWords ?? null) === (right.allowNewWords ?? null)
  )
}

/**
 * 生词容忍开关的请求校验（后端 md/41 §3.1）
 * 只接受布尔值或缺省；easy 的 0 生词是难度承诺，显式 true 直接 400。
 */
function assertAllowNewWords(payload) {
  const value = payload.allowNewWords

  if (value !== undefined && typeof value !== 'boolean') {
    throw new MockApiError('INVALID_REQUEST', 'allowNewWords 必须是布尔值', 400, 'allowNewWords')
  }
  if (payload.level === 'easy' && value === true) {
    throw new MockApiError(
      'INVALID_REQUEST',
      'easy 难度不支持生词，allowNewWords 只能用于 medium / hard',
      400,
      'allowNewWords',
    )
  }
}

function isTaskActive(task) {
  return task.status === 'queued' || task.status === 'running'
}

/** 按已过时间推进状态机；只在被查询时计算，不建定时器（与后端「回调驱动」同精神） */
function advanceTask(task, now = Date.now()) {
  const elapsed = now - task.startedAt

  if (task.cancelled) {
    task.status = 'cancelled'
    task.stage = 'done'
    task.durationMs = elapsed
    return task
  }

  if (task.status === 'succeeded' || task.status === 'failed') return task

  if (elapsed < TASK_PLANNING_MS) {
    task.status = 'queued'
    task.stage = 'queued'
    task.progress = { done: 0, total: 0 }
    return task
  }

  // planning 结束：词不够 / 参数问题的任务在这里失败
  if (task.failureCode) {
    task.status = 'failed'
    task.stage = 'done'
    task.progress = { done: 0, total: 0 }
    task.durationMs = elapsed
    task.error = {
      code: task.failureCode,
      message: task.failureMessage,
      details: task.failureDetails || {},
    }
    return task
  }

  const remaining = Math.max(1, task.total - task.reusedDone)
  const generationElapsed = elapsed - TASK_PLANNING_MS
  let done = Math.min(task.total, task.reusedDone + Math.floor(generationElapsed / TASK_SEGMENT_MS))
  const generationMs = remaining * TASK_SEGMENT_MS

  if (generationElapsed < generationMs) {
    task.status = 'running'
    task.stage = 'generating'
  } else {
    done = task.total
    const checkingElapsed = generationElapsed - generationMs

    if (checkingElapsed < TASK_CHECKING_MS) {
      task.status = 'running'
      task.stage = 'checking'
    } else if (checkingElapsed < TASK_CHECKING_MS + TASK_SAVING_MS) {
      task.status = 'running'
      task.stage = 'saving'
    } else {
      task.status = 'succeeded'
      task.stage = 'done'
      task.durationMs = elapsed
      if (!task.readingId) {
        const reading = createReadingRecord(readDb(), task.params, task.available)
        task.readingId = reading.id
      }
    }
  }

  task.progress = { done, total: task.total }
  return task
}

function toTaskDto(task) {
  advanceTask(task)

  const settled = ['succeeded', 'failed', 'cancelled'].includes(task.status)
  const isQueued = task.stage === 'queued'

  return {
    taskId: task.taskId,
    status: task.status,
    stage: task.stage,
    progress: { ...task.progress },
    selectedWords: isQueued ? [] : task.selectedWords,
    segments: isQueued
      ? []
      : Array.from({ length: task.progress.total }, (_, index) => {
          const position = index + 1
          let status = 'pending'
          if (position <= task.progress.done) status = 'accepted'
          else if (task.status === 'running' && position === task.progress.done + 1) {
            status = 'generating'
          }
          return {
            index: position,
            status,
            words: status === 'accepted' ? Math.round(task.params.targetWords / task.total) : 0,
          }
        }),
    readingId: task.readingId || null,
    error: task.status === 'failed' ? { ...task.error } : null,
    retryable: task.status === 'failed' ? !TASK_NOT_RETRYABLE.includes(task.error?.code) : false,
    retryCount: task.retryCount,
    durationMs: settled ? (task.durationMs ?? null) : null,
    params: { ...task.params },
    createdAt: task.createdAt,
  }
}

/** 建任务 / 重试的 202 响应只有状态骨架，不含 progress / segments（后端 md/31 §3.2） */
function taskAccepted(task, reused) {
  advanceTask(task)

  return {
    taskId: task.taskId,
    status: task.status,
    stage: task.stage,
    reused,
    params: { ...task.params },
  }
}

function requireTask(taskId) {
  const task = generationTasks.get(taskId)
  const expired = task && Date.now() - new Date(task.createdAt).getTime() > TASK_TTL_MS

  if (!task || expired) {
    generationTasks.delete(taskId)
    throw new MockApiError('TASK_NOT_FOUND', '这次生成的任务已经过期，请重新生成。', 404)
  }

  return task
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
    // 预检也要过词源：范围收窄后池子会变小，否则界面说「够」、点下去 422
    const scope = normalizeVocabScope(payload.vocabScope)
    const available = filterByScope(usableWords(db.words), scope).length
    // personalWords / knownWords 与词源无关（后端读整份个人词库），mock 同口径
    const personalWords = usableWords(db.words).length
    const knownWords = personalWords + KNOWN_FLOOR
    const finalModeUnlocked = personalWords >= FINAL_MODE_PERSONAL_WORDS
    const unlockShortage = Math.max(0, FINAL_MODE_PERSONAL_WORDS - personalWords)
    // 与后端同口径：目标词数 ≈ 篇幅的 15%，至少 1 个
    const required = Math.max(1, Math.round(targetWords * 0.15))
    const levels = {}

    LEVELS.forEach((level) => {
      const limit = LEVEL_LIMITS[level]
      const maxTargetWords =
        level === 'hard' && finalModeUnlocked ? FINAL_MODE_MAX_WORDS : limit.maxTargetWords
      // 本次请求算不算最终模式：hard + 超过 600 + 已解锁
      const active = level === 'hard' && targetWords > limit.maxTargetWords && finalModeUnlocked

      levels[level] = {
        // A 门：最终模式不挑目标词，报 0 / true，免得前端显示「还差 N 个」
        required: active ? 0 : required,
        sufficient: active || available >= required,
        shortage: active ? 0 : Math.max(0, required - available),
        // 每档各自的候选池（后端 md/22 §3）：mock 不按难度选池，三档同值，
        // 只保证字段形状一致，前端一律读 levels[level].available
        available,
        knownWords,
        personalWords,
        minKnown: active ? 0 : mockMinKnown(targetWords, level),
        unknownBudget: limit.unknownBudget,
        maxTargetWords,
        targetWordsAllowed: targetWords <= maxTargetWords,
        finalMode: {
          supported: level === 'hard',
          unlocked: finalModeUnlocked,
          unlockAt: FINAL_MODE_PERSONAL_WORDS,
          shortage: unlockShortage,
          active,
        },
        lengths: mockLengthLadder({ level, knownWords, personalWords }),
      }
    })

    const target = Math.round(targetWords * 1.1)
    const max = Math.round(targetWords * 1.15)
    const min = Math.round(targetWords * 0.85)

    return {
      targetWords,
      available,
      knownWords,
      personalWords,
      finalMode: {
        unlocked: finalModeUnlocked,
        unlockAt: FINAL_MODE_PERSONAL_WORDS,
        shortage: unlockShortage,
        maxTargetWords: FINAL_MODE_MAX_WORDS,
      },
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
    assertAllowNewWords(payload)

    const db = readDb()
    const gates = evaluateGenerationGates(payload, db)
    if (gates.error) throw gates.error

    return toSafeReading(createReadingRecord(db, payload, gates.available))
  },

  /**
   * 建生成任务（后端 md/31 §3.1）
   * 参数错误在建任务时就 400；词量闸门留给后台，以 failed + error.code 呈现。
   */
  async createTask(payload = {}, options = {}) {
    await wait(latency, options.signal)

    const { valid, errors } = validateSettings(payload)
    if (!valid) {
      const { field, message } = firstError(errors)
      throw new MockApiError('INVALID_REQUEST', message, 400, field)
    }
    assertAllowNewWords(payload)

    // clientToken 命中：任何状态的已有任务都直接返回，不扣第二次钱
    const token = typeof payload.clientToken === 'string' ? payload.clientToken.trim() : ''
    if (token) {
      const existing = [...generationTasks.values()].find((task) => task.clientToken === token)
      if (existing) return taskAccepted(existing, true)
    }

    // 同参数的在跑任务直接复用；参数不同则 409，前端按 details.taskId 切过去
    const running = [...generationTasks.values()].find(isTaskActive)
    if (running) {
      if (sameTaskParams(running.params, payload)) return taskAccepted(running, true)
      throw new MockApiError(
        'TASK_IN_PROGRESS',
        '已经有一次生成在进行中，等它跑完或先取消它。',
        409,
        '',
        { taskId: running.taskId },
      )
    }

    const db = readDb()
    const gates = evaluateGenerationGates(payload, db)

    const task = {
      taskId: `g${(generationTaskSeq += 1)}`,
      clientToken: token,
      params: {
        level: payload.level,
        targetWords: payload.targetWords,
        questionCount: payload.questionCount,
        vocabScope: normalizeVocabScope(payload.vocabScope),
        // 三态原样保留：null = 自动，不能压成 false（后端 md/42 §3.2）
        allowNewWords: typeof payload.allowNewWords === 'boolean' ? payload.allowNewWords : null,
      },
      status: 'queued',
      stage: 'queued',
      progress: { done: 0, total: 0 },
      total: Math.max(1, Math.min(12, Math.round(payload.targetWords / TASK_SEGMENT_WORDS))),
      reusedDone: 0,
      selectedWords: buildSelectedWords(gates.available),
      available: gates.available,
      failureCode: gates.error ? gates.error.error.code : '',
      failureMessage: gates.error ? gates.error.error.message : '',
      failureDetails: gates.error ? gates.error.error.details : null,
      readingId: '',
      error: null,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      startedAt: Date.now(),
      durationMs: null,
      cancelled: false,
    }

    generationTasks.set(task.taskId, task)
    return taskAccepted(task, false)
  },

  /** 轮询任务：只读、无副作用，同一任务多查几次结果一致 */
  async getTask(taskId, options = {}) {
    await wait(latency, options.signal)
    return toTaskDto(requireTask(taskId))
  },

  /** 取消：终态再调是 no-op；mock 里立刻落到 cancelled */
  async cancelTask(taskId, options = {}) {
    await wait(latency, options.signal)

    const task = requireTask(taskId)
    advanceTask(task)

    if (isTaskActive(task)) {
      task.cancelled = true
      advanceTask(task)
    }

    return toTaskDto(task)
  },

  /**
   * 重试：只接受 failed / cancelled，复用已落地的段，不重新规划
   * 建任务时被闸门挡下的任务重试仍会失败——真实后端同样是 retryable=false。
   */
  async retryTask(taskId, options = {}) {
    await wait(latency, options.signal)

    const task = requireTask(taskId)
    advanceTask(task)

    if (task.status === 'queued' || task.status === 'running' || task.status === 'succeeded') {
      return { ...taskAccepted(task, true), retryCount: task.retryCount }
    }

    const otherRunning = [...generationTasks.values()].find(
      (item) => item.taskId !== task.taskId && isTaskActive(item),
    )
    if (otherRunning) {
      throw new MockApiError(
        'TASK_IN_PROGRESS',
        '已经有一次生成在进行中，等它跑完或先取消它。',
        409,
        '',
        { taskId: otherRunning.taskId },
      )
    }

    // 复用已写好的段：闸门失败时没有可复用的进度
    task.reusedDone = task.failureCode ? 0 : Math.min(task.total, task.progress.done || 0)
    task.retryCount += 1
    task.cancelled = false
    task.status = 'queued'
    task.stage = 'queued'
    task.progress = { done: 0, total: 0 }
    task.error = null
    task.readingId = ''
    task.durationMs = null
    task.createdAt = new Date().toISOString()
    task.startedAt = Date.now()

    return { ...taskAccepted(task, false), retryCount: task.retryCount }
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
