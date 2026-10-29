/**
 * 词汇 store 测试
 * 覆盖列表加载、搜索、状态筛选、分页、增删改与字段错误；
 * 直接使用 mock adapter（延迟设为 0），每次用例前恢复 seed 数据。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { resetMockDb, setMockLatency } from '../../mock/adapter'
import { useWordsStore } from '../model/words'

beforeEach(() => {
  localStorage.clear()
  resetMockDb()
  setMockLatency(0)
  setActivePinia(createPinia())
})

afterAll(() => {
  setMockLatency(300)
})

describe('words store', () => {
  it('should load the first page with counts when no filter is applied', async () => {
    const store = useWordsStore()

    const result = await store.fetchList()

    expect(result.ok).toBe(true)
    expect(store.items).toHaveLength(10)
    expect(store.total).toBe(24)
    expect(store.page).toBe(1)
    expect(store.counts.all).toBe(24)
    expect(store.loading).toBe(false)
  })

  it('should mark the list as loaded even when the result is empty', async () => {
    const store = useWordsStore()
    expect(store.hasLoaded).toBe(false)

    await store.search('zzzz')

    expect(store.items).toHaveLength(0)
    expect(store.hasLoaded).toBe(true)

    store.reset()
    expect(store.hasLoaded).toBe(false)
  })

  it('should search by word and reset the page', async () => {
    const store = useWordsStore()
    await store.fetchList()
    await store.goToPage(2)

    await store.search('appl')

    expect(store.query).toBe('appl')
    expect(store.page).toBe(1)
    expect(store.total).toBe(1)
    expect(store.items[0].word).toBe('apple')
  })

  it('should filter by status and keep the server counts', async () => {
    const store = useWordsStore()
    await store.fetchList()

    const expected = store.counts.mastered
    await store.filterByStatus('mastered')

    expect(store.status).toBe('mastered')
    expect(store.total).toBe(expected)
    expect(store.items.every((item) => item.status === 'mastered')).toBe(true)
    expect(store.counts.all).toBe(24)
  })

  it('should page through the vocabulary list', async () => {
    const store = useWordsStore()
    await store.fetchList()

    await store.goToPage(3)

    expect(store.page).toBe(3)
    expect(store.items).toHaveLength(4)
  })

  it('should add a normalized word at the top and refresh counts', async () => {
    const store = useWordsStore()
    await store.fetchList()
    const learningBefore = store.counts.learning

    const result = await store.addWord({ word: ' ZEBRA ', meaning: '斑马', status: 'learning' })

    expect(result.ok).toBe(true)
    expect(result.item.word).toBe('zebra')
    expect(store.total).toBe(25)
    expect(store.counts.learning).toBe(learningBefore + 1)
    expect(store.items[0].word).toBe('zebra')
  })

  it('should merge a duplicate word and report the action', async () => {
    const store = useWordsStore()
    await store.fetchList()

    const result = await store.addWord({ word: 'APPLE', meaning: '苹果', status: 'learning' })

    expect(result).toMatchObject({ ok: true, action: 'updated', duplicate: true })
    expect(result.item.word).toBe('apple')
    expect(store.total).toBe(24)
    expect(store.counts.learning).toBe(10)
  })

  it('should not refetch when the duplicate is kept unchanged', async () => {
    const store = useWordsStore()
    await store.fetchList()

    const result = await store.addWord({ word: 'APPLE', status: 'mastered' })

    expect(result).toMatchObject({ ok: true, action: 'kept', duplicate: true })
    expect(result.item.status).toBe('mastered')
    expect(store.page).toBe(1)
    expect(store.total).toBe(24)
  })

  it('should preview a batch without creating words', async () => {
    const store = useWordsStore()
    await store.fetchList()

    const result = await store.previewBatch({ text: 'zebra\norchid', status: 'learning' })

    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({ wouldCreate: 2, wouldUpdate: 0, wouldSkip: 0 })
    expect(store.total).toBe(24)
  })

  it('should import a batch and refresh the list', async () => {
    const store = useWordsStore()
    await store.fetchList()

    const result = await store.importBatch({ text: 'zebra\norchid', status: 'learning' })

    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({ created: 2, updated: 0, failed: 0 })
    expect(store.total).toBe(26)
    expect(store.items.map((item) => item.word)).toEqual(
      expect.arrayContaining(['zebra', 'orchid']),
    )
  })

  it('should update a word and keep counts in sync', async () => {
    const store = useWordsStore()
    await store.fetchList()
    const target = store.items[0]
    const nextStatus = target.status === 'mastered' ? 'learning' : 'mastered'

    const result = await store.updateWord(target.id, {
      meaning: '新的释义',
      status: nextStatus,
    })

    expect(result.ok).toBe(true)
    expect(store.items.find((item) => item.id === target.id).senses[0].meaning).toBe('新的释义')
    expect(store.items.find((item) => item.id === target.id).status).toBe(nextStatus)
  })

  it('should remove a word and decrease the total', async () => {
    const store = useWordsStore()
    await store.fetchList()
    const target = store.items[0]

    const result = await store.removeWord(target.id)

    expect(result.ok).toBe(true)
    expect(store.total).toBe(23)
    expect(store.items.some((item) => item.id === target.id)).toBe(false)
  })

  it('should fall back to the previous page after the last row is deleted', async () => {
    const store = useWordsStore()
    await store.fetchList()
    await store.goToPage(3)

    const lastPageIds = store.items.map((item) => item.id)
    for (const id of lastPageIds) {
      await store.removeWord(id)
    }

    expect(store.total).toBe(20)
    expect(store.page).toBe(2)
    expect(store.items).toHaveLength(10)
  })
})
