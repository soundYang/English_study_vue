/**
 * 路由守卫测试
 * 覆盖已提交练习跳转结果页、未提交练习进入答题页、空 id 放行与标题更新。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { registerGuards } from '../guards'
import { resetMockDb, setMockLatency } from '../../mock/adapter'
import { useReadingStore } from '../../stores/model/reading'

const handlers = {}

function createRouter() {
  return {
    beforeEach(fn) {
      handlers.before = fn
    },
    afterEach(fn) {
      handlers.after = fn
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetMockDb()
  setMockLatency(0)
  setActivePinia(createPinia())
  registerGuards(createRouter())
})

afterAll(() => {
  setMockLatency(300)
})

describe('reading route guard', () => {
  it('should let a generated reading enter the answering page', async () => {
    const outcome = await handlers.before({ name: 'reading', params: { id: 'r5' } })
    const store = useReadingStore()

    expect(outcome).toBe(true)
    expect(store.phase).toBe('answering')
    expect(store.reading.id).toBe('r5')
  })

  it('should redirect a submitted reading to the result page', async () => {
    const outcome = await handlers.before({ name: 'reading', params: { id: 'r1' } })
    const store = useReadingStore()

    expect(outcome).toEqual({
      name: 'reading-result',
      params: { id: 'r1' },
      replace: true,
    })
    expect(store.phase).toBe('submitted')
  })

  it('should pass through an empty id and other routes', async () => {
    expect(await handlers.before({ name: 'reading', params: {} })).toBe(true)
    expect(await handlers.before({ name: 'home', params: {} })).toBe(true)
  })

  it('should update the document title after navigation', () => {
    handlers.after({ meta: { title: '我的单词' } })
    expect(document.title).toBe('我的单词 · Word Reading')

    handlers.after({ meta: {} })
    expect(document.title).toBe('Word Reading')
  })
})
