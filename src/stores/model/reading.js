/**
 * 当前练习状态
 * 承载生成任务、加载、作答、计时、提交与结果，供全局生成覆盖层、答题页与结果页共享。
 * 请求生命周期、轮询与错误归一化集中在 store 内，视图只负责触发、导航与提示。
 * 安全约束：提交前只保存安全 DTO；用户选择写入 sessionStorage，正确答/翻译从不落盘。
 *
 * 生成态：creating → generating（queued / running）→ fetching → answering
 *         失败为 error，取消为 cancelled，任务过期回 idle（后端 md/32 §3）
 * 用法：const reading = useReadingStore()
 *       reading.generate({ level, targetWords, questionCount }, { availableWords, from })
 *       reading.resumeGeneration()   // 刷新后按 localStorage 的 taskId 续上
 *       await reading.retryGeneration()
 *       reading.cancelGeneration()
 *       await reading.ensureReading('r5')
 *       reading.setAnswer(1, 2)
 *       await reading.submit()
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  cancelGenerationTask,
  createGenerationTask,
  fetchGenerationTask,
  fetchReading,
  retryGenerationTask,
  submitReading,
} from '../../api/readings'
import { normalizeApiError } from '../../errors'
import { localStore, sessionStore, storageKeys } from '../../unit/storage'

const EMPTY_SUMMARY = { level: '', targetWords: 0, questionCount: 0, availableWords: null }

// 轮询节奏（后端 md/32 §5）：前 10s 每 1s，之后每 2s；连续 3 次网络错误后翻倍，上限 5s
const POLL_FAST_MS = 1000
const POLL_SLOW_MS = 2000
const POLL_FAST_WINDOW_MS = 10 * 1000
const POLL_BACKOFF_AFTER = 3
const POLL_BACKOFF_MAX_MS = 5000

// 取正文通常只有几十毫秒，不停一下的话「正在整理页面」一帧都看不到就跳走了。
// 只约束最短停留时间，不改变真实失败 / 成功的判定。
const FETCH_MIN_MS = 900

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 原样重试只会再失败一次的错误码：覆盖层据此不显示「重试」（后端 md/32 §9） */
// QUOTA_EXCEEDED 也在此列：额度要到明天才恢复，原样重试只会再吃一次 429（md/35 §7.2）
// FREE_BUDGET_EXHAUSTED 同理且更彻底：全局免费池不会自己恢复，重试必定还是 503（md/36 §6.2）
const NON_RETRYABLE_CODES = [
  'INSUFFICIENT_VOCABULARY',
  'VOCABULARY_TOO_SMALL',
  'INVALID_REQUEST',
  'QUOTA_EXCEEDED',
  'FREE_BUDGET_EXHAUSTED',
]

function isDocumentHidden() {
  return typeof document !== 'undefined' && document.hidden
}

/** 一次用户点击一个 token：双击 / 网络重发复用同一个，后端不会扣两次钱 */
function createClientToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `gen-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** 建议用时 15:00；仅提示，不自动交卷 */
export const READING_DURATION_SECONDS = 15 * 60

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.name === 'CanceledError'
}

/** 只恢复仍然合法（题目存在、选项在范围内）的选择，防止脏存储干扰提交 */
function restoreAnswers(readingId, questions) {
  const raw = sessionStore.get(storageKeys.answers(readingId), null)
  const restored = {}

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return restored

  questions.forEach((question) => {
    const selected = raw[question.id]
    if (Number.isInteger(selected) && selected >= 0 && selected < question.options.length) {
      restored[question.id] = selected
    }
  })

  return restored
}

function restoreRemaining(readingId) {
  // Number(null) === 0，必须先排除“没有存储”的情况，否则会被误判为计时归零
  const raw = sessionStore.get(storageKeys.timer(readingId), null)
  if (raw === null || raw === undefined || raw === '') return READING_DURATION_SECONDS

  const stored = Number(raw)
  if (!Number.isFinite(stored)) return READING_DURATION_SECONDS
  return Math.min(READING_DURATION_SECONDS, Math.max(0, Math.floor(stored)))
}

function clearSavedSession(readingId) {
  sessionStore.remove(storageKeys.answers(readingId))
  sessionStore.remove(storageKeys.timer(readingId))
}

export const useReadingStore = defineStore('reading', () => {
  const reading = ref(null)
  const phase = ref('idle')
  const error = ref(null)
  const summary = ref({ ...EMPTY_SUMMARY })

  const answers = ref({})
  const remainingSeconds = ref(READING_DURATION_SECONDS)
  const result = ref(null)
  const loading = ref(false)
  const loadError = ref(null)
  const submitting = ref(false)
  const submitError = ref('')

  // 生成任务的完整 DTO 与轮询状态；视图只读 task / progress，不自己算阶段
  const task = ref(null)
  const taskId = ref('')
  const cancelling = ref(false)
  const pendingReadingId = ref('')
  const cooldownUntil = ref(0)

  // 每次生成/加载分配递增 id，取消或重新进入后旧请求的回调不能再改写状态
  let activeId = 0
  let loadSeq = 0
  let createController = null
  let pollTimer = null
  let pollStartedAt = 0
  let pollFailures = 0
  let pollSeq = 0
  let visibilityBound = false
  // 建任务失败后重试要复用同一次点击的参数与 clientToken
  let lastRequest = null
  let taskFrom = '/settings'

  // creating / fetching 也算「生成中」：覆盖层、按钮禁用与离开后的落点都靠它
  const isGenerating = computed(
    () => phase.value === 'creating' || phase.value === 'generating' || phase.value === 'fetching',
  )
  const hasGenerationError = computed(() => phase.value === 'error' && Boolean(error.value))
  const isSubmitting = computed(() => submitting.value)
  const answeredCount = computed(() => {
    const questions = reading.value?.questions || []
    return questions.filter((question) => answers.value[question.id] != null).length
  })

  /** 写入安全 DTO，并按当前阅读恢复答案与计时 */
  function setReading(next) {
    reading.value = next
    if (!next) return

    result.value = null
    loadError.value = null
    submitError.value = ''
    answers.value = restoreAnswers(next.id, next.questions)
    remainingSeconds.value = restoreRemaining(next.id)
    phase.value = 'answering'
  }

  /** 写入完整结果并清理本地暂存；结果只存在内存中 */
  function applyResult(next) {
    if (!next) return
    result.value = next
    phase.value = 'submitted'
    submitError.value = ''
    answers.value = {}
    remainingSeconds.value = READING_DURATION_SECONDS
    clearSavedSession(next.id)
    // 保留安全 DTO，避免跳转结果页的一瞬间闪回骨架屏
    if (reading.value && reading.value.id !== next.id) reading.value = null
  }

  /**
   * 加载答题页/守卫所需的数据
   * 已提交时返回 { submitted: true }，由守卫或页面决定跳转结果页；
   * 失败时写入 loadError，页面展示错误卡并可 force 重试。
   */
  async function ensureReading(id, { force = false } = {}) {
    const key = String(id ?? '').trim()

    if (!key) {
      loadError.value = { code: 'READING_NOT_FOUND', message: '这篇练习不存在或已被删除' }
      return { ok: false, code: 'READING_NOT_FOUND', message: loadError.value.message }
    }

    if (!force) {
      if (result.value?.id === key && phase.value === 'submitted') {
        return { ok: true, submitted: true, result: result.value }
      }
      if (reading.value?.id === key && phase.value === 'answering') {
        return { ok: true, submitted: false, reading: reading.value }
      }
    }

    const current = (loadSeq += 1)
    loading.value = true
    loadError.value = null
    submitError.value = ''
    reading.value = null
    // 切换阅读时清掉上一条完整结果，防止结果页在请求返回前短暂渲染旧数据
    if (result.value?.id !== key) result.value = null

    try {
      const data = await fetchReading(key)
      if (current !== loadSeq) return { ok: false, stale: true }

      loading.value = false

      if (data?.status === 'submitted') {
        applyResult(data)
        return { ok: true, submitted: true, result: data }
      }

      setReading(data)
      return { ok: true, submitted: false, reading: data }
    } catch (caught) {
      if (current !== loadSeq) return { ok: false, stale: true }

      loading.value = false
      const normalized = normalizeApiError(caught)
      loadError.value = {
        code: normalized?.code || 'LOAD_FAILED',
        message: normalized?.message || '网络出了点问题，请稍后重试。',
        // 排查号：用户报错时念出来，日志里能直接检索
        requestId: normalized?.requestId || '',
      }
      return { ok: false, code: loadError.value.code, message: loadError.value.message }
    }
  }

  /** 记录用户选择：只写 sessionStorage 的下标，不写任何答案字段 */
  function setAnswer(questionId, selectedOption) {
    if (phase.value !== 'answering' || submitting.value) return false
    if (!reading.value) return false

    const question = reading.value.questions.find((item) => item.id === questionId)
    if (!question) return false
    if (
      !Number.isInteger(selectedOption) ||
      selectedOption < 0 ||
      selectedOption >= question.options.length
    ) {
      return false
    }

    if (answers.value[questionId] === selectedOption) return true

    answers.value = { ...answers.value, [questionId]: selectedOption }
    sessionStore.set(storageKeys.answers(reading.value.id), answers.value)
    return true
  }

  /** 计时每秒调用；0 表示建议用时结束，仍可继续作答 */
  function setRemainingSeconds(value) {
    const safe = Math.min(READING_DURATION_SECONDS, Math.max(0, Math.floor(Number(value) || 0)))
    remainingSeconds.value = safe
    if (reading.value?.id && phase.value === 'answering') {
      sessionStore.set(storageKeys.timer(reading.value.id), safe)
    }
  }

  /** 提交全部题目；未作答按 null 提交，由后端判为错误 */
  async function submit() {
    if (submitting.value) {
      return { ok: false, code: 'SUBMITTING', message: '正在提交，请稍候。' }
    }
    if (!reading.value) {
      return { ok: false, code: 'NO_READING', message: '练习还没有加载完成。' }
    }
    if (phase.value !== 'answering') {
      return { ok: false, code: 'INVALID_STATE', message: '当前状态不能提交答案。' }
    }

    const currentReading = reading.value
    const payload = currentReading.questions.map((question) => ({
      questionId: question.id,
      selectedOption: answers.value[question.id] ?? null,
    }))

    submitting.value = true
    submitError.value = ''

    try {
      const data = await submitReading(currentReading.id, payload)
      submitting.value = false
      applyResult(data)
      return { ok: true, result: data }
    } catch (caught) {
      const normalized = normalizeApiError(caught)

      // 已在其他标签页或刷新前提交：拉取完整结果后直接进入结果页
      if (normalized?.code === 'ALREADY_SUBMITTED') {
        try {
          const full = await fetchReading(currentReading.id)
          if (full?.status === 'submitted') {
            submitting.value = false
            applyResult(full)
            return { ok: true, result: full, alreadySubmitted: true }
          }
        } catch {
          // 拉取失败时按普通提交错误处理，答案仍保留
        }
      }

      submitting.value = false
      submitError.value = normalized?.message || '提交失败，请重试'
      return {
        ok: false,
        code: normalized?.code || 'SUBMIT_FAILED',
        message: submitError.value,
      }
    }
  }

  /** 清空某篇练习的答案与计时（提交成功后由 applyResult 调用） */
  function clearSession(id) {
    clearSavedSession(id)
  }

  function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
  }

  function schedulePoll(delay) {
    stopPolling()
    pollTimer = setTimeout(() => {
      pollTimer = null
      void poll()
    }, delay)
  }

  /** 前 10s 每 1s，之后每 2s；连续 3 次网络错误后翻倍，上限 5s（后端 md/32 §5） */
  function nextPollDelay() {
    const base = Date.now() - pollStartedAt < POLL_FAST_WINDOW_MS ? POLL_FAST_MS : POLL_SLOW_MS
    if (pollFailures < POLL_BACKOFF_AFTER) return base

    const factor = 2 ** Math.min(pollFailures - POLL_BACKOFF_AFTER + 1, 2)
    return Math.min(base * factor, POLL_BACKOFF_MAX_MS)
  }

  function bindVisibility() {
    if (visibilityBound || typeof document === 'undefined') return
    document.addEventListener('visibilitychange', handleVisibility)
    visibilityBound = true
  }

  function unbindVisibility() {
    if (!visibilityBound || typeof document === 'undefined') return
    document.removeEventListener('visibilitychange', handleVisibility)
    visibilityBound = false
  }

  function handleVisibility() {
    if (!isGenerating.value) return

    // 后台标签页的定时器会被浏览器节流，不如主动停；回前台立刻补一次
    if (isDocumentHidden()) {
      stopPolling()
      return
    }
    stopPolling()
    void poll()
  }

  function persistGenerationTask() {
    if (!taskId.value) return

    localStore.set(storageKeys.generationTask, {
      taskId: taskId.value,
      from: taskFrom,
      availableWords: summary.value.availableWords,
      level: summary.value.level,
      targetWords: summary.value.targetWords,
      questionCount: summary.value.questionCount,
    })
  }

  function readStoredGenerationTask() {
    const stored = localStore.get(storageKeys.generationTask, null)
    if (!stored || typeof stored !== 'object') return null
    if (typeof stored.taskId !== 'string' || !stored.taskId) return null
    return stored
  }

  function clearStoredGenerationTask() {
    localStore.remove(storageKeys.generationTask)
  }

  function applyTaskParams(params) {
    if (!params) return

    summary.value = {
      ...summary.value,
      level: params.level ?? summary.value.level,
      targetWords: params.targetWords ?? summary.value.targetWords,
      questionCount: params.questionCount ?? summary.value.questionCount,
    }
  }

  function setGenerationError({
    code,
    message,
    field = '',
    details = {},
    requestId = '',
    retryable = true,
  }) {
    // 覆盖层靠 field / details 判断「差多少、该缩篇幅还是加词」
    error.value = { code, message, field, details, requestId, retryable }
    phase.value = 'error'
    unbindVisibility()
    cancelling.value = false
  }

  /** 把一次请求级错误转成覆盖层能用的形状；429 顺势记下冷却截止时间 */
  function failGeneration(caught, fallbackMessage = '这次生成没有成功，请稍后重试。') {
    const normalized = normalizeApiError(caught)
    const code = normalized?.code || 'GENERATION_FAILED'
    const retryAfter = Number(normalized?.retryAfter) || 0
    if (code === 'RATE_LIMITED' && retryAfter > 0) {
      cooldownUntil.value = Date.now() + retryAfter * 1000
    }

    const remainingSeconds = Math.max(0, Math.ceil((cooldownUntil.value - Date.now()) / 1000))
    setGenerationError({
      code,
      message: normalized?.message || fallbackMessage,
      field: normalized?.field || '',
      details: {
        ...(normalized?.details || {}),
        ...(remainingSeconds > 0 ? { remainingSeconds } : {}),
      },
      requestId: normalized?.requestId || '',
      retryable:
        code !== 'RATE_LIMITED' && code !== 'TASK_NOT_FOUND' && !NON_RETRYABLE_CODES.includes(code),
    })
    return false
  }

  /** 429 冷却期不再发请求：三个生成入口都从 generate / retryGeneration 进来 */
  function passCooldown() {
    const remaining = Math.ceil((cooldownUntil.value - Date.now()) / 1000)
    if (remaining <= 0) return true

    setGenerationError({
      code: 'RATE_LIMITED',
      message: `生成太频繁：请 ${remaining} 秒后再试。`,
      details: { remainingSeconds: remaining },
      retryable: false,
    })
    return false
  }

  function resetGenerationSession(payload = {}, options = {}) {
    stopPolling()
    unbindVisibility()
    createController?.abort()
    createController = null
    task.value = null
    taskId.value = ''
    cancelling.value = false
    pendingReadingId.value = ''
    error.value = null
    phase.value = 'creating'
    summary.value = {
      level: payload.level ?? '',
      targetWords: payload.targetWords ?? 0,
      questionCount: payload.questionCount ?? 0,
      availableWords: options.availableWords ?? null,
    }
    taskFrom = options.from || '/settings'
    pollStartedAt = Date.now()
    pollFailures = 0
    pollSeq = 0
  }

  /** 状态机推进：running / queued 继续轮询，终态各自收尾 */
  function applyTask(dto) {
    if (!dto?.taskId) return

    task.value = dto
    taskId.value = dto.taskId
    applyTaskParams(dto.params)

    if (dto.status === 'queued' || dto.status === 'running') {
      phase.value = 'generating'
      persistGenerationTask()
      bindVisibility()
      if (!isDocumentHidden()) schedulePoll(nextPollDelay())
      return
    }

    if (dto.status === 'succeeded') {
      stopPolling()
      void collectArticle(dto.readingId)
      return
    }

    if (dto.status === 'cancelled') {
      stopPolling()
      unbindVisibility()
      clearStoredGenerationTask()
      cancelling.value = false
      pendingReadingId.value = ''
      phase.value = 'cancelled'
      return
    }

    // failed：保留 localStorage 里的 taskId，刷新后还能回来点 /retry
    stopPolling()
    unbindVisibility()
    cancelling.value = false
    const payload = dto.error || {}
    setGenerationError({
      code: payload.code || 'GENERATION_FAILED',
      message: payload.message || '这次生成没有成功，请稍后重试。',
      field: payload.field || '',
      details: payload.details || {},
      requestId: payload.requestId || '',
      retryable:
        typeof dto.retryable === 'boolean'
          ? dto.retryable
          : !NON_RETRYABLE_CODES.includes(payload.code),
    })
  }

  /**
   * 取正文
   * succeeded 只说明任务完了，正文还没到手；必须等 GET /readings/:id 成功才算成功，
   * 否则会出现「动画先结束、进阅读页才报错」（后端 md/32 §3）。
   */
  async function collectArticle(readingId) {
    const current = activeId
    error.value = null
    pendingReadingId.value = readingId || ''

    if (!readingId) {
      setGenerationError({
        code: 'ARTICLE_NOT_READY',
        message: '文章已经生成，但暂时取不到内容。',
        retryable: true,
      })
      return
    }

    phase.value = 'fetching'
    const startedAt = Date.now()

    try {
      const data = await fetchReading(readingId)
      if (current !== activeId) return

      // 让「正在整理页面」至少站住 FETCH_MIN_MS；等待期间同样要防过期请求回写
      const elapsed = Date.now() - startedAt
      if (elapsed < FETCH_MIN_MS) await delay(FETCH_MIN_MS - elapsed)
      if (current !== activeId) return

      pendingReadingId.value = ''
      clearStoredGenerationTask()
      unbindVisibility()
      // 任务已经交付：清掉快照，避免下次失败提示误读上一次的 retryCount
      task.value = null
      taskId.value = ''
      setReading(data)
    } catch (caught) {
      if (current !== activeId) return

      const normalized = normalizeApiError(caught)
      setGenerationError({
        code: normalized?.code || 'ARTICLE_FETCH_FAILED',
        message: normalized?.message || '文章已经生成，但读取失败了。',
        requestId: normalized?.requestId || '',
        retryable: true,
      })
    }
  }

  async function poll() {
    const current = activeId
    const id = taskId.value
    if (!id) return

    const seq = (pollSeq += 1)

    try {
      const dto = await fetchGenerationTask(id)
      if (current !== activeId || seq !== pollSeq) return

      pollFailures = 0
      applyTask(dto)
    } catch (caught) {
      if (current !== activeId || seq !== pollSeq) return

      const normalized = normalizeApiError(caught)
      if (normalized?.code === 'TASK_NOT_FOUND') {
        // 超过 24h TTL 或 taskId 不存在：没有恢复的可能，直接回 idle（后端 md/32 §5）
        stopPolling()
        unbindVisibility()
        clearStoredGenerationTask()
        task.value = null
        taskId.value = ''
        cancelling.value = false
        pendingReadingId.value = ''
        phase.value = 'idle'
        return
      }

      // 断网 ≠ 任务失败：动画状态不动，任务在后端照常跑
      pollFailures += 1
      if (isGenerating.value && !isDocumentHidden()) schedulePoll(nextPollDelay())
    }
  }

  async function sendCreate(request, current) {
    phase.value = 'creating'
    createController = new AbortController()
    pollStartedAt = Date.now()
    pollFailures = 0
    pollSeq = 0

    try {
      const created = await createGenerationTask(
        { ...request.payload, clientToken: request.clientToken },
        { signal: createController.signal },
      )
      if (current !== activeId) return false

      if (!created?.taskId) {
        setGenerationError({
          code: 'GENERATION_FAILED',
          message: '这次生成没有成功，请稍后重试。',
          retryable: true,
        })
        return false
      }

      taskId.value = created.taskId
      applyTaskParams(created.params)
      phase.value = 'generating'
      persistGenerationTask()
      bindVisibility()
      // 202 只有状态骨架：立刻查一次拿完整 DTO（progress / segments）
      if (!isDocumentHidden()) schedulePoll(0)
      return true
    } catch (caught) {
      if (current !== activeId) return false

      if (isAbortError(caught)) {
        phase.value = 'idle'
        return false
      }

      const normalized = normalizeApiError(caught)
      // 另一个不同参数的任务在跑：按 details.taskId 切过去轮询，而不是报错
      if (normalized?.code === 'TASK_IN_PROGRESS' && normalized.details?.taskId) {
        adoptTask(normalized.details.taskId)
        return true
      }

      return failGeneration(caught)
    } finally {
      if (current === activeId) createController = null
    }
  }

  function adoptTask(id) {
    taskId.value = id
    phase.value = 'generating'
    persistGenerationTask()
    bindVisibility()
    if (!isDocumentHidden()) schedulePoll(0)
  }

  async function retryTask(id) {
    const current = (activeId += 1)
    stopPolling()
    unbindVisibility()
    phase.value = 'creating'
    error.value = null
    cancelling.value = false
    pollStartedAt = Date.now()
    pollFailures = 0
    pollSeq = 0

    try {
      const dto = await retryGenerationTask(id)
      if (current !== activeId) return false
      if (!dto?.taskId) return false

      taskId.value = dto.taskId
      applyTaskParams(dto.params)
      task.value = { ...(task.value || {}), ...dto }
      phase.value = 'generating'
      persistGenerationTask()
      bindVisibility()
      if (!isDocumentHidden()) schedulePoll(0)
      return true
    } catch (caught) {
      if (current !== activeId) return false

      const normalized = normalizeApiError(caught)
      if (normalized?.code === 'TASK_IN_PROGRESS' && normalized.details?.taskId) {
        adoptTask(normalized.details.taskId)
        return true
      }
      return failGeneration(caught)
    }
  }

  /**
   * 生成阅读材料（任务化）
   * 建任务 → 立刻查一次 → 轮询 → 成功后取正文，全程异步；
   * 调用方不再 await 到文章，改为观察 phase / task / reading。
   * options.availableWords 只用于文案；options.from 是取消 / 失败后的返回落点。
   */
  async function generate(payload, options = {}) {
    if (isGenerating.value) return null
    if (!passCooldown()) return null

    lastRequest = {
      payload: { ...payload },
      availableWords: options.availableWords ?? null,
      from: options.from || '/settings',
      clientToken: createClientToken(),
    }

    resetGenerationSession(payload, options)
    const current = (activeId += 1)
    await sendCreate(lastRequest, current)
    return null
  }

  /**
   * 重试
   * 正文没取到 → 只重取；任务已 failed / cancelled → 调 /retry 复用已写好的段；
   * 建任务就失败 → 复用同一次点击的 clientToken 与参数。
   */
  async function retryGeneration() {
    if (isGenerating.value) return false
    if (!passCooldown()) return false

    if (pendingReadingId.value) {
      void collectArticle(pendingReadingId.value)
      return true
    }

    if (task.value && (task.value.status === 'failed' || task.value.status === 'cancelled')) {
      return retryTask(task.value.taskId)
    }

    if (lastRequest) {
      resetGenerationSession(lastRequest.payload, lastRequest)
      const current = (activeId += 1)
      return sendCreate(lastRequest, current)
    }

    return false
  }

  /**
   * 刷新后恢复
   * 只凭 localStorage 里的 taskId 直接 GET 一次；返回 { taskId, from } 供页面判断
   * 「直接以运行态出现、不重播入场」（后端 md/32 §5）。
   */
  function resumeGeneration() {
    if (isGenerating.value) return { taskId: taskId.value, from: taskFrom }

    const stored = readStoredGenerationTask()
    if (!stored) return null

    activeId += 1
    stopPolling()
    unbindVisibility()
    createController?.abort()
    createController = null
    task.value = null
    taskId.value = stored.taskId
    cancelling.value = false
    pendingReadingId.value = ''
    error.value = null
    phase.value = 'generating'
    taskFrom = stored.from || '/settings'
    summary.value = {
      level: stored.level || '',
      targetWords: stored.targetWords || 0,
      questionCount: stored.questionCount || 0,
      availableWords: stored.availableWords ?? null,
    }
    pollStartedAt = Date.now()
    pollFailures = 0
    pollSeq = 0
    bindVisibility()
    if (!isDocumentHidden()) void poll()

    return { taskId: stored.taskId, from: taskFrom }
  }

  /**
   * 取消生成
   * 语义是「不再继续付费」，不是回滚；取消不一定瞬时，继续轮询到 cancelled 为止。
   * 建任务还在飞行时只做本地放弃，后端若已落库会在下一次建任务 409 时被接回。
   */
  async function cancelGeneration() {
    if (!isGenerating.value || cancelling.value) return false

    // 任务已经成功，正文正在取：取消没有意义，让它走完
    if (phase.value === 'fetching') return false

    if (!taskId.value) {
      activeId += 1
      createController?.abort()
      createController = null
      stopPolling()
      unbindVisibility()
      clearStoredGenerationTask()
      task.value = null
      cancelling.value = false
      pendingReadingId.value = ''
      phase.value = 'idle'
      return true
    }

    cancelling.value = true

    try {
      const dto = await cancelGenerationTask(taskId.value)
      cancelling.value = false

      if (dto) applyTask(dto)
      else if (isGenerating.value && !pollTimer) schedulePoll(nextPollDelay())
      return true
    } catch (caught) {
      cancelling.value = false

      const normalized = normalizeApiError(caught)
      if (normalized?.code === 'TASK_NOT_FOUND') {
        stopPolling()
        unbindVisibility()
        clearStoredGenerationTask()
        task.value = null
        taskId.value = ''
        pendingReadingId.value = ''
        phase.value = 'idle'
        return true
      }

      // 网络失败也不改动画状态：任务可能已在别处取消，继续轮询等 cancelled
      if (isGenerating.value && !pollTimer) schedulePoll(nextPollDelay())
      return false
    }
  }

  /** 关闭生成失败覆盖层，保留设置页 */
  function dismissGeneration() {
    if (isGenerating.value) return
    phase.value = 'idle'
    error.value = null
  }

  /** 清空当前练习、答案、计时与结果 */
  function reset() {
    activeId += 1
    loadSeq += 1
    stopPolling()
    unbindVisibility()
    createController?.abort()
    createController = null
    task.value = null
    taskId.value = ''
    cancelling.value = false
    pendingReadingId.value = ''
    cooldownUntil.value = 0
    lastRequest = null
    taskFrom = '/settings'
    clearStoredGenerationTask()
    reading.value = null
    phase.value = 'idle'
    error.value = null
    summary.value = { ...EMPTY_SUMMARY }
    answers.value = {}
    remainingSeconds.value = READING_DURATION_SECONDS
    result.value = null
    loading.value = false
    loadError.value = null
    submitting.value = false
    submitError.value = ''
  }

  return {
    reading,
    phase,
    error,
    summary,
    task,
    taskId,
    cancelling,
    pendingReadingId,
    answers,
    remainingSeconds,
    result,
    loading,
    loadError,
    submitting,
    submitError,
    isGenerating,
    hasGenerationError,
    isSubmitting,
    answeredCount,
    setReading,
    ensureReading,
    setAnswer,
    setRemainingSeconds,
    submit,
    clearSession,
    generate,
    resumeGeneration,
    retryGeneration,
    cancelGeneration,
    dismissGeneration,
    reset,
  }
})
