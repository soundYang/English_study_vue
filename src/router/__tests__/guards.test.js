/**
 * 路由守卫测试
 * 覆盖答题页与结果页的双向重定向、加载失败放行、空 id 放行与标题更新。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { registerGuards } from '../guards'
import { resetMockDb, setMockLatency } from '../../mock/adapter'
import { useReadingStore } from '../../stores/model/reading'
import { localStore, storageKeys } from '../../unit/storage'

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
  // 阅读路由默认需要登录：预置令牌后，这些用例只验证阅读页自身的跳转逻辑
  localStore.set(storageKeys.accessToken, 'sess_guard_test')
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

describe('result route guard', () => {
  it('should let a submitted reading open the result page', async () => {
    const outcome = await handlers.before({ name: 'reading-result', params: { id: 'r2' } })
    const store = useReadingStore()

    expect(outcome).toBe(true)
    expect(store.phase).toBe('submitted')
    expect(store.result.id).toBe('r2')
  })

  it('should redirect an unsubmitted reading back to the answering page', async () => {
    const outcome = await handlers.before({ name: 'reading-result', params: { id: 'r5' } })

    expect(outcome).toEqual({
      name: 'reading',
      params: { id: 'r5' },
      replace: true,
    })
  })

  it('should pass through a missing reading and an empty id', async () => {
    expect(await handlers.before({ name: 'reading-result', params: { id: 'r404' } })).toBe(true)
    expect(await handlers.before({ name: 'reading-result', params: {} })).toBe(true)
  })
})
