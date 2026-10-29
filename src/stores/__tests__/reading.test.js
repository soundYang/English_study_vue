/**
 * 当前练习 store 测试（任务化生成）
 * 覆盖：建任务 → 轮询 → 取正文的闭环；失败出口；取消要等服务端确认；
 * 重试走 /retry 而不是重建；刷新恢复；409 接管；文章已生成但取正文失败。
 * 所有请求走 vi.mock，轮询用假定时器推进，不依赖 mock adapter 的节奏。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { storageKeys } from '../../unit/storage'

vi.mock('../../api/readings', () => ({
  createGenerationTask: vi.fn(),
  fetchGenerationTask: vi.fn(),
  cancelGenerationTask: vi.fn(),
  retryGenerationTask: vi.fn(),
  fetchReading: vi.fn(),
  submitReading: vi.fn(),
}))

import {
  cancelGenerationTask,
  createGenerationTask,
  fetchGenerationTask,
  fetchReading,
  retryGenerationTask,
} from '../../api/readings'
import { useReadingStore } from '../model/reading'

const SETTINGS = { level: 'easy', targetWords: 100, questionCount: 3 }
const PARAMS = { ...SETTINGS, vocabScope: ['all'] }
const READING = {
  id: 'r9',
  title: 'A New Page',
  article: 'A short article.',
  questions: [{ id: 1, question: 'Pick one', options: ['a', 'b'] }],
  status: 'generated',
}

let store = null

/** 完整任务 DTO；只覆盖当前用例关心的字段 */
function taskDto(overrides = {}) {
  return {
    taskId: 't1',
    status: 'running',
    stage: 'generating',
    progress: { done: 1, total: 4 },
    params: PARAMS,
    selectedWords: [],
    segments: [],
    readingId: null,
    error: null,
    retryable: false,
    retryCount: 0,
    durationMs: null,
    createdAt: '2026-10-28T00:00:00.000Z',
    ...overrides,
  }
}

/** 与 normalizeApiError 认得的形状一致（mock / 真实后端同构） */
function apiError(code, { message = code, details = {}, status = 400 } = {}) {
  const error = new Error(message)
  error.status = status
  error.error = { code, message, details }
  return error
}

function readStoredTask() {
  const raw = localStorage.getItem(storageKeys.generationTask)
  return raw ? JSON.parse(raw) : null
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  localStorage.clear()
  setActivePinia(createPinia())
  store = useReadingStore()

  createGenerationTask.mockResolvedValue({
    taskId: 't1',
    status: 'queued',
    stage: 'queued',
    reused: false,
    params: PARAMS,
  })
})

afterEach(() => {
  store?.reset()
  store = null
  vi.useRealTimers()
})

describe('reading store generation task', () => {
  it('should only succeed after the article is fetched', async () => {
    fetchGenerationTask.mockResolvedValueOnce(taskDto()).mockResolvedValueOnce(
      taskDto({
        status: 'succeeded',
        stage: 'done',
        progress: { done: 4, total: 4 },
        readingId: 'r9',
      }),
    )
    fetchReading.mockResolvedValue(READING)

    await store.generate(SETTINGS, { availableWords: 20 })

    const [payload, options] = createGenerationTask.mock.calls[0]
    expect(payload).toMatchObject({ ...SETTINGS, clientToken: expect.any(String) })
    expect(options.signal).toBeTruthy()
    expect(store.phase).toBe('generating')

    // 建任务后的第一次查询只拿 running：任务还没完，不能收动画
    await vi.advanceTimersByTimeAsync(0)
    expect(store.task.progress).toEqual({ done: 1, total: 4 })
    expect(store.phase).toBe('generating')
    expect(readStoredTask()).toMatchObject({ taskId: 't1', level: 'easy', targetWords: 100 })

    await vi.advanceTimersByTimeAsync(1000)

    expect(fetchReading).toHaveBeenCalledWith('r9')
    // 取正文成功后还要站住 900ms，让「正在整理页面」真的看得见
    expect(store.phase).toBe('fetching')

    await vi.advanceTimersByTimeAsync(900)
    expect(store.phase).toBe('answering')
    expect(store.reading).toEqual(READING)
    expect(store.taskId).toBe('')
    expect(readStoredTask()).toBeNull()
  })

  it('should stop at fetching when the article request fails, then retry only the fetch', async () => {
    fetchGenerationTask.mockResolvedValue(
      taskDto({ status: 'succeeded', stage: 'done', readingId: 'r9' }),
    )
    fetchReading.mockRejectedValueOnce(new Error('offline'))

    await store.generate(SETTINGS)
    await vi.advanceTimersByTimeAsync(0)

    expect(store.phase).toBe('error')
    expect(store.error).toMatchObject({ code: 'ARTICLE_FETCH_FAILED', retryable: true })
    expect(store.pendingReadingId).toBe('r9')

    fetchReading.mockResolvedValue(READING)
    expect(await store.retryGeneration()).toBe(true)
    await vi.advanceTimersByTimeAsync(0)

    // 任务已经成功，重试只重取正文：不重新建任务
    expect(createGenerationTask).toHaveBeenCalledTimes(1)
    expect(fetchReading).toHaveBeenCalledTimes(2)
    expect(store.phase).toBe('fetching')

    await vi.advanceTimersByTimeAsync(900)
    expect(store.phase).toBe('answering')
  })

  it('should surface a failed task with retryable from the server', async () => {
    fetchGenerationTask.mockResolvedValue(
      taskDto({
        status: 'failed',
        stage: 'done',
        progress: { done: 0, total: 0 },
        error: { code: 'INSUFFICIENT_VOCABULARY', message: '词不够', details: {} },
        retryable: false,
      }),
    )

    await store.generate(SETTINGS)
    await vi.advanceTimersByTimeAsync(0)

    expect(store.phase).toBe('error')
    expect(store.error).toMatchObject({
      code: 'INSUFFICIENT_VOCABULARY',
      message: '词不够',
      retryable: false,
    })
  })

  // 503 免费池用尽不是限流：不写 cooldownUntil（否则会显示一个假的倒计时），也不允许重试
  it('should keep a free-budget 503 out of the rate-limit cooldown', async () => {
    createGenerationTask.mockRejectedValue(
      apiError('FREE_BUDGET_EXHAUSTED', {
        message: '免费生成额度已用完，请接入自己的 API Key 后继续使用',
        details: { limitTokens: 200000000, usedTokens: 200000031 },
        status: 503,
      }),
    )

    await store.generate(SETTINGS)

    expect(store.phase).toBe('error')
    expect(store.error).toMatchObject({ code: 'FREE_BUDGET_EXHAUSTED', retryable: false })
    // remainingSeconds 只由 429 的 Retry-After 推导；503 没有这个头
    expect(store.error.details.remainingSeconds).toBeUndefined()
  })

  // 任务是异步失败时后端可能不带 retryable，靠 NON_RETRYABLE_CODES 兜底（md/36 §10 ②）
  it('should treat a free-budget task failure as non-retryable without a flag', async () => {
    fetchGenerationTask.mockResolvedValue(
      taskDto({
        status: 'failed',
        stage: 'done',
        error: {
          code: 'FREE_BUDGET_EXHAUSTED',
          message: '免费生成额度已用完，请接入自己的 API Key 后继续使用',
          details: {},
        },
        retryable: undefined,
      }),
    )

    await store.generate(SETTINGS)
    await vi.advanceTimersByTimeAsync(0)

    expect(store.phase).toBe('error')
    expect(store.error.retryable).toBe(false)
  })

  it('should go idle when the task has expired', async () => {
    fetchGenerationTask.mockRejectedValue(apiError('TASK_NOT_FOUND', { status: 404 }))

    await store.generate(SETTINGS)
    await vi.advanceTimersByTimeAsync(0)

    expect(store.phase).toBe('idle')
    expect(store.taskId).toBe('')
    expect(readStoredTask()).toBeNull()
  })

  it('should keep the animation state through network errors and keep polling', async () => {
    fetchGenerationTask.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(taskDto())

    await store.generate(SETTINGS)
    await vi.advanceTimersByTimeAsync(0)

    // 断网 ≠ 任务失败：状态不动，退避后再查
    expect(store.phase).toBe('generating')

    await vi.advanceTimersByTimeAsync(1000)
    expect(store.phase).toBe('generating')
    expect(store.task.progress).toEqual({ done: 1, total: 4 })
  })

  it('should keep polling after cancel until the server reports cancelled', async () => {
    fetchGenerationTask
      .mockResolvedValueOnce(taskDto())
      .mockResolvedValueOnce(taskDto({ status: 'cancelled', stage: 'done' }))
    cancelGenerationTask.mockResolvedValue(taskDto({ status: 'running' }))

    await store.generate(SETTINGS)
    await vi.advanceTimersByTimeAsync(0)

    expect(await store.cancelGeneration()).toBe(true)
    expect(cancelGenerationTask).toHaveBeenCalledWith('t1')
    // 落在别的实例上时取消不是瞬时，轮询还会看到一次 running
    expect(store.phase).toBe('generating')
    expect(store.cancelling).toBe(false)

    await vi.advanceTimersByTimeAsync(1000)

    expect(store.phase).toBe('cancelled')
    expect(readStoredTask()).toBeNull()
  })

  it('should retry a failed task through /retry instead of creating a new one', async () => {
    fetchGenerationTask
      .mockResolvedValueOnce(
        taskDto({
          status: 'failed',
          stage: 'done',
          error: { code: 'AI_PROVIDER_ERROR', message: '上游挂了', details: {} },
          retryable: true,
        }),
      )
      .mockResolvedValueOnce(taskDto({ status: 'succeeded', stage: 'done', readingId: 'r9' }))
    retryGenerationTask.mockResolvedValue({
      taskId: 't1',
      status: 'queued',
      stage: 'queued',
      reused: false,
      retryCount: 1,
      params: PARAMS,
    })
    fetchReading.mockResolvedValue(READING)

    await store.generate(SETTINGS)
    await vi.advanceTimersByTimeAsync(0)
    expect(store.error.retryable).toBe(true)

    expect(await store.retryGeneration()).toBe(true)
    expect(retryGenerationTask).toHaveBeenCalledWith('t1')
    expect(createGenerationTask).toHaveBeenCalledTimes(1)
    expect(store.phase).toBe('generating')

    await vi.advanceTimersByTimeAsync(0)
    expect(store.phase).toBe('fetching')

    await vi.advanceTimersByTimeAsync(900)
    expect(store.phase).toBe('answering')
  })

  it('should reuse the client token when creating the task itself failed', async () => {
    createGenerationTask.mockRejectedValueOnce(new Error('offline'))

    await store.generate(SETTINGS)
    expect(store.phase).toBe('error')
    const firstToken = createGenerationTask.mock.calls[0][0].clientToken

    expect(await store.retryGeneration()).toBe(true)
    expect(createGenerationTask).toHaveBeenCalledTimes(2)
    expect(createGenerationTask.mock.calls[1][0].clientToken).toBe(firstToken)
  })

  it('should adopt the running task from a 409 instead of failing', async () => {
    createGenerationTask.mockRejectedValueOnce(
      apiError('TASK_IN_PROGRESS', { status: 409, details: { taskId: 't7' } }),
    )
    fetchGenerationTask.mockResolvedValue(taskDto({ taskId: 't7' }))

    await store.generate(SETTINGS)

    expect(store.phase).toBe('generating')
    expect(store.taskId).toBe('t7')

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchGenerationTask).toHaveBeenCalledWith('t7')
  })

  it('should resume polling from localStorage after a refresh', async () => {
    localStorage.setItem(
      storageKeys.generationTask,
      JSON.stringify({
        taskId: 't3',
        from: '/',
        availableWords: 12,
        level: 'hard',
        targetWords: 600,
        questionCount: 5,
      }),
    )
    fetchGenerationTask.mockResolvedValue(
      taskDto({ taskId: 't3', params: { level: 'hard', targetWords: 600, questionCount: 5 } }),
    )

    const resumed = store.resumeGeneration()

    expect(resumed).toEqual({ taskId: 't3', from: '/' })
    expect(store.phase).toBe('generating')
    expect(store.summary).toMatchObject({
      level: 'hard',
      targetWords: 600,
      questionCount: 5,
      availableWords: 12,
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchGenerationTask).toHaveBeenCalledWith('t3')
  })

  it('should clear generation state on reset', async () => {
    fetchGenerationTask.mockResolvedValue(taskDto())

    await store.generate(SETTINGS)
    await vi.advanceTimersByTimeAsync(0)
    expect(readStoredTask()).not.toBeNull()

    store.reset()

    expect(store.phase).toBe('idle')
    expect(store.task).toBeNull()
    expect(store.taskId).toBe('')
    expect(readStoredTask()).toBeNull()
  })
})
