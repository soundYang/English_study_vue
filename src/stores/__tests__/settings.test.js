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
    expect(store.vocabScope).toEqual(['all'])
    expect(store.hasSavedSettings).toBe(false)
  })

  it('should persist settings with an updatedAt timestamp', () => {
    const store = useSettingsStore()

    const result = store.save({ level: 'hard', targetWords: 220, questionCount: 8 })

    expect(result.valid).toBe(true)
    expect(store.hasSavedSettings).toBe(true)
    expect(store.payload).toEqual({
      level: 'hard',
      targetWords: 220,
      questionCount: 8,
      vocabScope: ['all'],
    })

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored).toMatchObject({ level: 'hard', targetWords: 220, questionCount: 8 })
    expect(typeof stored.updatedAt).toBe('string')
  })

  it('should persist and copy the vocab scope', () => {
    const store = useSettingsStore()
    const scope = ['today_new']

    store.save({ level: 'easy', targetWords: 100, questionCount: 5, vocabScope: scope })
    // 传进来的数组不能被 store 直接持有，否则外部改数组会悄悄改掉设置
    scope.push('today_reviewed')

    expect(store.vocabScope).toEqual(['today_new'])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).vocabScope).toEqual(['today_new'])

    const payload = store.payload
    payload.vocabScope.push('today_reviewed')
    expect(store.vocabScope).toEqual(['today_new'])
  })

  it('should reject an empty vocab scope without writing to storage', () => {
    const store = useSettingsStore()

    const result = store.save({ level: 'easy', targetWords: 100, questionCount: 5, vocabScope: [] })

    expect(result.valid).toBe(false)
    expect(result.errors.vocabScope).toBeTruthy()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
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
    // 这份老数据没有 vocabScope，属于升级前存下的设置
    expect(store.vocabScope).toEqual(['all'])
  })

  it('should restore a stored vocab scope and normalize dirty values', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        level: 'easy',
        targetWords: 100,
        questionCount: 5,
        vocabScope: ['today_new', 'today_new', 'yesterday'],
        updatedAt: '2026-10-27T08:00:00.000Z',
      }),
    )

    const store = useSettingsStore()

    expect(store.vocabScope).toEqual(['today_new'])
    expect(store.hasSavedSettings).toBe(true)
  })

  it('should fall back to defaults when stored data is corrupted', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ level: 'impossible' }))

    const store = useSettingsStore()

    expect(store.level).toBe('easy')
    expect(store.hasSavedSettings).toBe(false)
  })

  it('should keep allowNewWords out of the payload while it is automatic', () => {
    const store = useSettingsStore()

    store.save({ level: 'medium', targetWords: 200, questionCount: 5 })

    // 自动 = 请求里不出现这个键，后端按「最终模式开、其余关」判定（md/42 §3.2）
    expect('allowNewWords' in store.payload).toBe(false)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).allowNewWords).toBeNull()
  })

  it('should persist an explicit allowNewWords choice', () => {
    const store = useSettingsStore()

    store.save({ level: 'medium', targetWords: 200, questionCount: 5, allowNewWords: true })

    expect(store.allowNewWords).toBe(true)
    expect(store.payload.allowNewWords).toBe(true)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).allowNewWords).toBe(true)
  })

  it('should restore an explicit false without turning it into automatic', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        level: 'hard',
        targetWords: 300,
        questionCount: 5,
        allowNewWords: false,
        updatedAt: '2026-10-29T08:00:00.000Z',
      }),
    )

    const store = useSettingsStore()

    expect(store.allowNewWords).toBe(false)
    expect(store.payload.allowNewWords).toBe(false)
  })

  it('should read old settings without the field as automatic', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        level: 'hard',
        targetWords: 300,
        questionCount: 5,
        updatedAt: '2026-10-29T08:00:00.000Z',
      }),
    )

    const store = useSettingsStore()

    expect(store.allowNewWords).toBeNull()
    expect('allowNewWords' in store.payload).toBe(false)
  })

  it('should drop the switch back to automatic when the level becomes easy', () => {
    const store = useSettingsStore()
    store.save({ level: 'medium', targetWords: 200, questionCount: 5, allowNewWords: true })

    // easy 的 0 生词是承诺：后端对 easy + true 直接 400，本地先清成自动
    const result = store.save({ level: 'easy', targetWords: 100, questionCount: 5 })

    expect(result.valid).toBe(true)
    expect(store.allowNewWords).toBeNull()
    expect('allowNewWords' in store.payload).toBe(false)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).allowNewWords).toBeNull()
  })

  it('should clear storage and restore defaults on reset', () => {
    const store = useSettingsStore()
    store.save({
      level: 'hard',
      targetWords: 300,
      questionCount: 8,
      vocabScope: ['today_reviewed'],
    })

    store.reset()

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(store.level).toBe('easy')
    expect(store.targetWords).toBe(100)
    expect(store.questionCount).toBe(5)
    expect(store.vocabScope).toEqual(['all'])
    expect(store.hasSavedSettings).toBe(false)
  })
})
