/**
 * 阅读设置 store 测试
 * 覆盖默认值、持久化、非法数据回退、刷新恢复与重置。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '../model/settings'

const STORAGE_KEY = 'wr.settings.v1'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('settings store', () => {
  it('should start from defaults when nothing is stored', () => {
    const store = useSettingsStore()

    expect(store.level).toBe('easy')
    expect(store.targetWords).toBe(100)
    expect(store.questionCount).toBe(5)
    expect(store.hasSavedSettings).toBe(false)
  })

  it('should persist settings with an updatedAt timestamp', () => {
    const store = useSettingsStore()

    const result = store.save({ level: 'hard', targetWords: 220, questionCount: 8 })

    expect(result.valid).toBe(true)
    expect(store.hasSavedSettings).toBe(true)
    expect(store.payload).toEqual({ level: 'hard', targetWords: 220, questionCount: 8 })

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored).toMatchObject({ level: 'hard', targetWords: 220, questionCount: 8 })
    expect(typeof stored.updatedAt).toBe('string')
  })

  it('should reject invalid settings without writing to storage', () => {
    const store = useSettingsStore()

    const result = store.save({ targetWords: 55 })

    expect(result.valid).toBe(false)
    expect(result.errors.targetWords).toBeTruthy()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(store.targetWords).toBe(100)
  })

  it('should restore saved settings when the store is recreated', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        level: 'medium',
        targetWords: 150,
        questionCount: 5,
        updatedAt: '2026-10-27T08:00:00.000Z',
      }),
    )

    setActivePinia(createPinia())
    const store = useSettingsStore()

    expect(store.level).toBe('medium')
    expect(store.targetWords).toBe(150)
    expect(store.questionCount).toBe(5)
    expect(store.updatedAt).toBe('2026-10-27T08:00:00.000Z')
    expect(store.hasSavedSettings).toBe(true)
  })

  it('should fall back to defaults when stored data is corrupted', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ level: 'impossible' }))

    const store = useSettingsStore()

    expect(store.level).toBe('easy')
    expect(store.hasSavedSettings).toBe(false)
  })

  it('should clear storage and restore defaults on reset', () => {
    const store = useSettingsStore()
    store.save({ level: 'hard', targetWords: 300, questionCount: 8 })

    store.reset()

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(store.level).toBe('easy')
    expect(store.targetWords).toBe(100)
    expect(store.questionCount).toBe(5)
    expect(store.hasSavedSettings).toBe(false)
  })
})
