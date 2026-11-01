/**
 * 词汇 store 测试
 * 覆盖列表加载、搜索、状态筛选、分页、增删改与字段错误；
 * 直接使用 mock adapter（延迟设为 0），每次用例前恢复 seed 数据。
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { resetMockDb, setMockLatency } from '../../mock/adapter'
import { useWordsStore } from '../model/words'
import { fetchDailyPlan } from '../../api/words'

// 今日复习接口在真实 mock 之外包一层 spy，用来制造一次性失败（md/56 P1）
vi.mock('../../api/words', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchDailyPlan: vi.fn(actual.fetchDailyPlan),
    reviewWord: vi.fn(actual.reviewWord),
    reviewWords: vi.fn(actual.reviewWords),
  }
})

beforeEach(() => {
  localStorage.clear()
  resetMockDb()
  setMockLatency(0)
  setActivePinia(createPinia())
  vi.mocked(fetchDailyPlan).mockClear()
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
    expect(store.studyCounts.all).toBe(24)
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

  // 标签页筛的是 `study`（studyState 口径），不是 `status`：后者把墓碑词也算进 new 一档
  it('should filter by study state and keep the server counts', async () => {
    const store = useWordsStore()
    await store.fetchList()

    const expected = store.studyCounts.mastered
    await store.filterByStudy('mastered')

    expect(store.study).toBe('mastered')
    expect(store.total).toBe(expected)
    expect(store.items.every((item) => item.studyState === 'mastered')).toBe(true)
    expect(store.studyCounts.all).toBe(24)
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
    // 今天加的 learning 词，studyState 是「新词」：两者本来就是两套口径
    const newBefore = store.studyCounts.new

    const result = await store.addWord({ word: ' ZEBRA ', meaning: '斑马', status: 'learning' })

    expect(result.ok).toBe(true)
    expect(result.item.word).toBe('zebra')
    expect(result.item.studyState).toBe('new')
    expect(store.total).toBe(25)
    expect(store.studyCounts.new).toBe(newBefore + 1)
    expect(store.items[0].word).toBe('zebra')
  })

  it('should merge a duplicate word and report the action', async () => {
    const store = useWordsStore()
    await store.fetchList()

    const result = await store.addWord({ word: 'APPLE', meaning: '苹果', status: 'learning' })

    expect(result).toMatchObject({ ok: true, action: 'updated', duplicate: true })
    expect(result.item.word).toBe('apple')
    expect(store.total).toBe(24)
    // apple 由已掌握改成学习中：种子里 9 个 learning 词都是 9 月的，全部算复习中
    expect(store.studyCounts.reviewing).toBe(14)
    expect(store.studyCounts.mastered).toBe(10)
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

describe('words store file import', () => {
  /** 生成只含字母的唯一词，避免序号里的数字触发 WORD_PATTERN */
  function alphaWord(index) {
    let value = index
    let suffix = ''

    do {
      suffix = String.fromCharCode(97 + (value % 26)) + suffix
      value = Math.floor(value / 26) - 1
    } while (value >= 0)

    return `test${suffix}`
  }

  it('should expose file extraction through the store', async () => {
    const store = useWordsStore()

    const result = await store.extractImportFile(
      new File(['apple 苹果'], 'words.txt', { type: 'text/plain' }),
    )

    expect(result).toMatchObject({
      ok: true,
      data: { source: 'txt', stats: { total: 1, valid: 1, invalid: 0 } },
    })
  })

  it('should forward the AI mode to the extract API and keep its error code', async () => {
    const store = useWordsStore()

    const result = await store.extractImportFile(
      new File(['apple'], 'words.txt', { type: 'text/plain' }),
      { mode: 'ai' },
    )

    // 演示账号没接自备 Key：mock 与真实后端一样回 409
    expect(result).toMatchObject({ ok: false, code: 'USER_API_KEY_REQUIRED' })
  })

  it('should submit 201 rows as 200 + 1 and remap errors to the file index', async () => {
    const store = useWordsStore()
    await store.fetchList()

    const rows = Array.from({ length: 201 }, (_, index) => ({
      index,
      word: alphaWord(index),
      meaning: '',
    }))
    rows[200] = { index: 999, word: 'bad word', meaning: '' }
    const progress = []

    const result = await store.importBatch({
      rows,
      status: 'learning',
      onProgress: (done, total) => progress.push([done, total]),
    })

    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({ created: 200, failed: 1, total: 201 })
    // 第二批只发 1 条，错误下标必须加回 200 的偏移，再映射到文件行号
    expect(result.data.errors[0]).toMatchObject({ index: 999, word: 'bad word' })
    expect(result.data.chunkErrors).toEqual([])
    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ])
    expect(store.total).toBe(224)
  })

  it('should reject an empty file row list without calling the batch endpoint', async () => {
    const store = useWordsStore()

    const result = await store.importBatch({ rows: [] })

    expect(result).toMatchObject({ ok: false, code: 'INVALID_REQUEST' })
  })
})

describe('words store · 今日复习', () => {
  it('should load the daily plan and keep the counts from the server', async () => {
    const store = useWordsStore()

    const result = await store.loadDailyPlan()

    expect(result.ok).toBe(true)
    expect(store.dailyPlan.review.remaining).toBeGreaterThan(0)
    // 单批最多 50 个，remaining 可以更大（积压顺延）
    expect(store.dailyPlan.review.words.length).toBeLessThanOrEqual(50)
    expect(store.dailyPlanLoading).toBe(false)
  })

  it('should stay silent when the plan request fails', async () => {
    const store = useWordsStore()
    vi.mocked(fetchDailyPlan).mockRejectedValueOnce(new Error('network down'))

    const result = await store.loadDailyPlan()

    expect(result.ok).toBe(false)
    // 入口条据此隐藏，页面其余内容不受影响
    expect(store.dailyPlan).toBeNull()
    expect(store.dailyPlanLoading).toBe(false)
  })

  it('should consume one word locally after a single review', async () => {
    const store = useWordsStore()
    await store.loadDailyPlan()

    const target = store.dailyPlan.review.words[0]
    const before = { ...store.dailyPlan.review }

    const result = await store.reviewWord(target.id, 'pass')

    expect(result.ok).toBe(true)
    expect(store.dailyPlan.review.remaining).toBe(before.remaining - 1)
    expect(store.dailyPlan.review.doneToday).toBe(before.doneToday + 1)
    expect(store.dailyPlan.review.today).toBe(Math.min(before.today, before.remaining - 1))
    expect(store.dailyPlan.review.words.some((item) => item.id === target.id)).toBe(false)
  })

  it('should keep the counters when a single review fails', async () => {
    const store = useWordsStore()
    await store.loadDailyPlan()

    const before = { ...store.dailyPlan.review }

    const result = await store.reviewWord('word_missing', 'pass')

    expect(result.ok).toBe(false)
    expect(result.code).toBe('WORD_NOT_FOUND')
    expect(store.dailyPlan.review.remaining).toBe(before.remaining)
    expect(store.dailyPlan.review.doneToday).toBe(before.doneToday)
  })

  it('should drop skipped words and reconcile the plan after a batch review', async () => {
    const store = useWordsStore()
    await store.loadDailyPlan()

    const target = store.dailyPlan.review.words[0]

    const result = await store.reviewBatch([
      { id: target.id, result: 'pass' },
      { id: 'word_missing', result: 'pass' },
    ])

    expect(result.ok).toBe(true)
    expect(result.updated).toBe(1)
    expect(result.skipped.map((item) => item.id)).toContain('word_missing')
    // skipped 不扣 remaining，随后静默重拉以后端为准
    const ids = store.dailyPlan.review.words.map((item) => item.id)
    expect(ids).not.toContain(target.id)
    expect(ids).not.toContain('word_missing')
  })
})
