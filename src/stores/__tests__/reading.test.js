/**
 * 当前练习 store 测试
 * 覆盖生成成功、安全 DTO、词汇不足、参数非法、取消与重置。
 * 统一把 mock 延迟与最短展示设为 0，避免测试等待真实时间。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useReadingStore } from '../model/reading'
import { mockWords, resetMockDb, setMockLatency } from '../../mock/adapter'

const SETTINGS = { level: 'easy', targetWords: 100, questionCount: 3 }

beforeEach(() => {
  setMockLatency(0)
  resetMockDb()
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('reading store generation', () => {
  it('should store a safe DTO and move to answering on success', async () => {
    const store = useReadingStore()

    const reading = await store.generate(SETTINGS, {
      minDuration: 0,
      availableWords: 20,
    })

    expect(reading.id).toMatch(/^r\d+$/)
    expect(store.phase).toBe('answering')
    expect(store.reading).toEqual(reading)
    expect(store.summary).toEqual({
      level: 'easy',
      targetWords: 100,
      questionCount: 3,
      availableWords: 20,
    })
    expect(reading.translation).toBeUndefined()
    expect(JSON.stringify(reading)).not.toContain('correctAnswer')
  })

  it('should expose INSUFFICIENT_VOCABULARY when too few words can be used', async () => {
    const all = await mockWords.list({ page: 1, pageSize: 50 })
    for (const item of all.items) {
      await mockWords.update(item.id, { status: 'new' })
    }

    const store = useReadingStore()
    const reading = await store.generate(SETTINGS, { minDuration: 0 })

    expect(reading).toBeNull()
    expect(store.phase).toBe('error')
    expect(store.error.code).toBe('INSUFFICIENT_VOCABULARY')
    expect(store.error.message).toContain('至少需要')
  })

  it('should surface INVALID_REQUEST for out-of-range settings', async () => {
    const store = useReadingStore()

    await store.generate({ level: 'easy', targetWords: 55, questionCount: 3 }, { minDuration: 0 })

    expect(store.phase).toBe('error')
    expect(store.error.code).toBe('INVALID_REQUEST')
  })

  it('should abort an in-flight generation and return to idle', async () => {
    setMockLatency(50)
    const store = useReadingStore()

    const pending = store.generate(SETTINGS, { minDuration: 0 })
    store.cancelGeneration()

    await expect(pending).resolves.toBeNull()
    expect(store.phase).toBe('idle')
    expect(store.error).toBeNull()
    expect(store.reading).toBeNull()
  })

  it('should clear generation state on reset', async () => {
    const store = useReadingStore()
    await store.generate(SETTINGS, { minDuration: 0 })

    store.reset()

    expect(store.reading).toBeNull()
    expect(store.phase).toBe('idle')
    expect(store.error).toBeNull()
    expect(store.summary.level).toBe('')
  })
})
