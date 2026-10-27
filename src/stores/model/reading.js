/**
 * 当前练习状态
 * 承载生成、加载、作答、计时、提交与结果，供全局生成覆盖层、答题页与结果页共享。
 * 请求生命周期与错误归一化集中在 store 内，视图只负责触发、导航与提示。
 * 安全约束：提交前只保存安全 DTO；用户选择写入 sessionStorage，正确答/翻译从不落盘。
 *
 * 状态：idle / generating / answering / submitting / submitted / error（生成失败）
 * 用法：const reading = useReadingStore()
 *       await reading.generate({ level, targetWords, questionCount }, { availableWords })
 *       await reading.ensureReading('r5')
 *       reading.setAnswer(1, 2)
 *       await reading.submit()
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchReading, generateReading, submitReading } from '../../api/readings'
import { normalizeApiError } from '../../errors'
import { sessionStore, storageKeys } from '../../unit/storage'

const DEFAULT_MIN_VISIBLE = 800
const EMPTY_SUMMARY = { level: '', targetWords: 0, questionCount: 0, availableWords: null }

/** 建议用时 15:00；仅提示，不自动交卷 */
export const READING_DURATION_SECONDS = 15 * 60

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.name === 'CanceledError'
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForMinVisible(startedAt, minVisible) {
  const remaining = minVisible - (Date.now() - startedAt)
  if (remaining > 0) await wait(remaining)
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

  // 每次生成/加载分配递增 id，取消或重新进入后旧请求的回调不能再改写状态
  let activeId = 0
  let loadSeq = 0
  let controller = null

  const isGenerating = computed(() => phase.value === 'generating')
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

  /**
   * 生成阅读材料
   * 返回安全 DTO 或 null（取消 / 失败），失败原因写入 error。
   * options.minDuration 默认 800ms，测试可传 0 关闭最短展示。
   */
  async function generate(payload, options = {}) {
    if (phase.value === 'generating') return null

    const current = (activeId += 1)
    const minVisible = Number.isFinite(options.minDuration)
      ? Math.max(0, options.minDuration)
      : DEFAULT_MIN_VISIBLE
    const startedAt = Date.now()

    controller = new AbortController()
    phase.value = 'generating'
    error.value = null
    summary.value = {
      level: payload.level,
      targetWords: payload.targetWords,
      questionCount: payload.questionCount,
      availableWords: options.availableWords ?? null,
    }

    try {
      const generated = await generateReading(payload, { signal: controller.signal })
      await waitForMinVisible(startedAt, minVisible)

      if (current !== activeId) return null

      setReading(generated)
      return generated
    } catch (caught) {
      if (current !== activeId) return null
      if (isAbortError(caught)) {
        phase.value = 'idle'
        return null
      }

      await waitForMinVisible(startedAt, minVisible)
      if (current !== activeId) return null

      const normalized = normalizeApiError(caught)
      error.value = {
        code: normalized?.code || 'GENERATION_FAILED',
        message: normalized?.message || '这次生成没有成功，请稍后重试。',
      }
      phase.value = 'error'
      return null
    } finally {
      if (current === activeId) controller = null
    }
  }

  /** 取消生成：立即中止请求并把状态退回 idle */
  function cancelGeneration() {
    activeId += 1
    controller?.abort()
    controller = null
    if (phase.value === 'generating') phase.value = 'idle'
  }

  /** 关闭生成失败覆盖层，保留设置页 */
  function dismissGeneration() {
    if (phase.value === 'generating') return
    phase.value = 'idle'
    error.value = null
  }

  /** 清空当前练习、答案、计时与结果 */
  function reset() {
    activeId += 1
    loadSeq += 1
    controller?.abort()
    controller = null
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
    cancelGeneration,
    dismissGeneration,
    reset,
  }
})
