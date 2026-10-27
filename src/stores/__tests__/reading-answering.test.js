/**
 * 答题状态测试
 * 覆盖安全 DTO、答案与计时恢复、选择持久化、判分提交、重复提交与 404。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mockReadings, resetMockDb, setMockLatency } from '../../mock/adapter'
import { useReadingStore } from '../model/reading'

const ANSWERS_KEY = 'wr.answers:r5'
const TIMER_KEY = 'wr.timer:r5'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetMockDb()
  setMockLatency(0)
  setActivePinia(createPinia())
})

afterAll(() => {
  setMockLatency(300)
})

describe('reading store answering', () => {
  it('should load a safe DTO and enter answering state', async () => {
    const store = useReadingStore()

    const outcome = await store.ensureReading('r5')

    expect(outcome.ok).toBe(true)
    expect(outcome.submitted).toBe(false)
    expect(store.phase).toBe('answering')
    expect(store.reading.title).toBe('The Courage to Begin')
    expect(store.reading.questions).toHaveLength(5)
    expect(store.remainingSeconds).toBe(900)
    expect(store.answers).toEqual({})

    const serialized = JSON.stringify(store.reading)
    expect(serialized).not.toContain('translation')
    expect(serialized).not.toContain('correctAnswer')
    expect(serialized).not.toContain('explanation')
    expect(serialized).not.toContain('userAnswers')
  })

  it('should restore only valid answers and the saved timer', async () => {
    sessionStorage.setItem(ANSWERS_KEY, JSON.stringify({ 1: 2, 2: 99, 3: 'x', 4: 0 }))
    sessionStorage.setItem(TIMER_KEY, JSON.stringify(480))
    const store = useReadingStore()

    await store.ensureReading('r5')

    expect(store.answers).toEqual({ 1: 2, 4: 0 })
    expect(store.remainingSeconds).toBe(480)
  })

  it('should persist a selection and reject out-of-range options', async () => {
    const store = useReadingStore()
    await store.ensureReading('r5')

    expect(store.setAnswer(1, 2)).toBe(true)
    expect(store.answers[1]).toBe(2)
    expect(JSON.parse(sessionStorage.getItem(ANSWERS_KEY))).toEqual({ 1: 2 })

    expect(store.setAnswer(1, 9)).toBe(false)
    expect(store.setAnswer(99, 1)).toBe(false)
    expect(store.answers).toEqual({ 1: 2 })
  })

  it('should persist the remaining seconds for refresh recovery', async () => {
    const store = useReadingStore()
    await store.ensureReading('r5')

    store.setRemainingSeconds(899)

    expect(store.remainingSeconds).toBe(899)
    expect(JSON.parse(sessionStorage.getItem(TIMER_KEY))).toBe(899)
  })

  it('should grade all answers, clear the session and keep the safe reading', async () => {
    const store = useReadingStore()
    await store.ensureReading('r5')

    const correct = { 1: 1, 2: 2, 3: 3, 4: 1, 5: 2 }
    Object.entries(correct).forEach(([questionId, option]) => {
      store.setAnswer(Number(questionId), option)
    })

    const outcome = await store.submit()

    expect(outcome.ok).toBe(true)
    expect(outcome.result.correctCount).toBe(5)
    expect(outcome.result.score).toBe(100)
    expect(outcome.result.translation).toBeTruthy()
    expect(store.phase).toBe('submitted')
    expect(store.result.score).toBe(100)
    expect(store.answers).toEqual({})
    expect(store.reading.id).toBe('r5')
    expect(sessionStorage.getItem(ANSWERS_KEY)).toBeNull()
    expect(sessionStorage.getItem(TIMER_KEY)).toBeNull()
  })

  it('should submit unanswered questions as null and count them wrong', async () => {
    const store = useReadingStore()
    await store.ensureReading('r5')
    store.setAnswer(1, 1)

    const outcome = await store.submit()

    expect(outcome.ok).toBe(true)
    expect(outcome.result.correctCount).toBe(1)
    expect(outcome.result.score).toBe(20)
    expect(outcome.result.results[1]).toMatchObject({ selectedOption: null, isCorrect: false })
  })

  it('should recover the result when the reading was already submitted', async () => {
    const store = useReadingStore()
    await store.ensureReading('r5')
    await mockReadings.submit('r5', [{ questionId: 1, selectedOption: 1 }])

    const outcome = await store.submit()

    expect(outcome.ok).toBe(true)
    expect(outcome.alreadySubmitted).toBe(true)
    expect(outcome.result.status).toBe('submitted')
    expect(store.phase).toBe('submitted')
    expect(store.result.status).toBe('submitted')
    expect(sessionStorage.getItem(ANSWERS_KEY)).toBeNull()
  })

  it('should redirect an already submitted reading to its result', async () => {
    await mockReadings.submit('r5', [{ questionId: 1, selectedOption: 1 }])
    const store = useReadingStore()

    const outcome = await store.ensureReading('r5')

    expect(outcome.ok).toBe(true)
    expect(outcome.submitted).toBe(true)
    expect(store.phase).toBe('submitted')
    expect(store.result.status).toBe('submitted')
    expect(store.result.score).toBe(20)
  })

  it('should keep a not-found error for the page to render', async () => {
    const store = useReadingStore()

    const outcome = await store.ensureReading('r404')

    expect(outcome.ok).toBe(false)
    expect(outcome.code).toBe('READING_NOT_FOUND')
    expect(store.loadError).toMatchObject({ code: 'READING_NOT_FOUND' })
    expect(store.reading).toBeNull()
    expect(store.loading).toBe(false)
  })
})
