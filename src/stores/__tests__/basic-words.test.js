/**
 * 基础词表 store 测试
 * 本页不做 mock 适配器，api 层用 vi.mock 替身，测试不能落到真实后端。
 * 重点固定三件事：换条件必须回第 1 页；写操作在有筛选时要重拉而不是就地改行；
 * 三态标记走同一个 PATCH，state 原样透传（md/52）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { fetchBasicWords, setBasicWordMark } from '../../api/basic-words'
import { BusinessError } from '../../errors'
import { useBasicWordsStore } from '../model/basic-words'
import { localStore, storageKeys } from '../../unit/storage'

vi.mock('../../api/basic-words', () => ({
  fetchBasicWords: vi.fn(),
  fetchPublicBasicWords: vi.fn(),
  setBasicWordMark: vi.fn(),
}))

const COUNTS = {
  all: 650,
  basic: 600,
  calendar: 19,
  abbreviation: 32,
  removable: 421,
  functionWord: 179,
  known: 0,
  learned: 0,
  removed: 0,
  untouched: 650,
}

function makeItem(overrides = {}) {
  return {
    word: 'abandon',
    kinds: ['basic'],
    kind: 'basic',
    isFunctionWord: false,
    removable: true,
    personalState: 'untouched',
    knownSource: null,
    personalStatus: null,
    wordId: null,
    cocaRank: 2201,
    phonetic: { uk: '/əˈbæn.dən/', us: '/əˈbæn.dən/' },
    senses: [{ pos: 'v.', meaning: '放弃；抛弃' }],
    summary: '放弃；抛弃',
    expansion: null,
    expansionMeaning: null,
    calendarType: null,
    ...overrides,
  }
}

function makePage(overrides = {}) {
  return {
    items: [makeItem(), makeItem({ word: 'ability' })],
    total: 2,
    page: 1,
    pageSize: 100,
    counts: { ...COUNTS },
    ...overrides,
  }
}

/** 等一轮宏任务，让 store 内部的 await 链跑到「已发出对账请求」的位置 */
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  localStorage.clear()
  // 本文件测个人数据源与写操作；游客公开数据源另有独立用例（md/45 §5.3）
  localStore.set(storageKeys.accessToken, 'sess_basic_words_store')
  setActivePinia(createPinia())
  vi.resetAllMocks()
  fetchBasicWords.mockResolvedValue(makePage())
})

describe('basic words store · 列表', () => {
  it('should request the basic group with 100 per page and keep the server counts', async () => {
    const store = useBasicWordsStore()

    const result = await store.fetchList()

    expect(result.ok).toBe(true)
    expect(fetchBasicWords).toHaveBeenCalledWith({
      q: '',
      group: 'basic',
      status: 'all',
      page: 1,
      pageSize: 100,
    })
    expect(store.items.map((row) => row.word)).toEqual(['abandon', 'ability'])
    expect(store.counts).toEqual(COUNTS)
    expect(store.loading).toBe(false)
    expect(store.error).toBe('')
  })

  it('should adopt the page the server converged to', async () => {
    fetchBasicWords.mockResolvedValueOnce(makePage({ page: 7 }))
    const store = useBasicWordsStore()

    await store.goToPage(99)

    expect(fetchBasicWords).toHaveBeenCalledWith(expect.objectContaining({ page: 99 }))
    expect(store.page).toBe(7)
  })

  it('should trim the query and go back to the first page', async () => {
    fetchBasicWords.mockResolvedValueOnce(makePage({ page: 4 }))
    const store = useBasicWordsStore()
    await store.goToPage(4)
    expect(store.page).toBe(4)

    await store.search('  放弃  ')

    expect(store.query).toBe('放弃')
    expect(fetchBasicWords).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: '放弃', page: 1 }),
    )
  })

  it('should request the first page again when the group or status changes', async () => {
    const store = useBasicWordsStore()

    await store.setStatus('removed')
    expect(fetchBasicWords).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'removed', page: 1 }),
    )

    await store.setGroup('calendar')
    expect(store.group).toBe('calendar')
    expect(fetchBasicWords).toHaveBeenLastCalledWith(
      expect.objectContaining({ group: 'calendar', status: 'removed', page: 1 }),
    )
  })

  it('should only accept the page sizes the interface supports', async () => {
    const store = useBasicWordsStore()

    const rejected = await store.setPageSize(200)
    expect(rejected.ok).toBe(false)
    expect(fetchBasicWords).not.toHaveBeenCalled()

    fetchBasicWords.mockResolvedValueOnce(makePage({ pageSize: 50 }))
    await store.setPageSize(50)

    expect(store.pageSize).toBe(50)
    expect(fetchBasicWords).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageSize: 50, page: 1 }),
    )
  })

  it('should ignore a response that arrives after a newer request', async () => {
    const store = useBasicWordsStore()
    let resolveFirst

    fetchBasicWords.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve
      }),
    )
    const first = store.fetchList()

    fetchBasicWords.mockResolvedValueOnce(
      makePage({ items: [makeItem({ word: 'ability' })], total: 1 }),
    )
    await store.fetchList()

    resolveFirst(makePage({ items: [makeItem({ word: 'abandon' })], total: 1 }))
    await first

    expect(store.items.map((row) => row.word)).toEqual(['ability'])
  })

  it('should surface the normalized message when the list request fails', async () => {
    fetchBasicWords.mockRejectedValueOnce(
      new BusinessError('网络出了点问题，请稍后重试。', 'NETWORK'),
    )
    const store = useBasicWordsStore()

    const result = await store.fetchList()

    expect(result.ok).toBe(false)
    expect(store.error).toContain('网络出了点问题')
    expect(store.loading).toBe(false)
  })
})

describe('basic words store · 三态标记', () => {
  it('should patch the row and the counts immediately when no status filter is active', async () => {
    const store = useBasicWordsStore()
    await store.fetchList()

    setBasicWordMark.mockResolvedValueOnce({
      item: makeItem({ personalState: 'removed', wordId: 'w-1' }),
      counts: { ...COUNTS, removed: 1, untouched: 649 },
    })

    let resolveRefetch
    fetchBasicWords.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefetch = resolve
      }),
    )

    const pending = store.setMark('abandon', 'unknown')
    await flush()

    // 对账还没回来，界面已经能显示新状态
    expect(store.counts.removed).toBe(1)
    expect(store.items[0]).toMatchObject({ word: 'abandon', personalState: 'removed' })

    resolveRefetch(makePage({ items: [makeItem({ word: 'abandon', personalState: 'removed' })] }))
    const result = await pending

    expect(result.ok).toBe(true)
    expect(setBasicWordMark).toHaveBeenCalledWith('abandon', 'unknown')
    expect(store.pendingWord).toBe('')
  })

  it('should refetch instead of patching the row when a status filter is active', async () => {
    const store = useBasicWordsStore()
    await store.fetchList()
    await store.setStatus('unknown')

    setBasicWordMark.mockResolvedValueOnce({
      item: makeItem({ personalState: 'known', knownSource: 'mark' }),
      counts: { ...COUNTS, known: 1, untouched: 649 },
    })

    let resolveRefetch
    fetchBasicWords.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefetch = resolve
      }),
    )

    const pending = store.setMark('abandon', 'known')
    await flush()

    // 「未标记」筛选下这一行已经不该出现，不能就地改成认识留在原地
    expect(store.items.find((row) => row.word === 'abandon')?.personalState).toBe('untouched')
    expect(fetchBasicWords).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'unknown', page: 1 }),
    )

    resolveRefetch(makePage({ items: [makeItem({ word: 'ability' })], total: 1 }))
    await pending

    expect(store.items.map((row) => row.word)).toEqual(['ability'])
  })

  it('should clear a mark with state none and refresh the counts', async () => {
    const store = useBasicWordsStore()
    await store.fetchList()

    setBasicWordMark.mockResolvedValueOnce({
      item: makeItem({ personalState: 'untouched', knownSource: null }),
      counts: { ...COUNTS, removed: 0, untouched: 650 },
    })

    const result = await store.setMark('abandon', 'none')

    expect(result.ok).toBe(true)
    expect(setBasicWordMark).toHaveBeenCalledWith('abandon', 'none')
    expect(store.counts.removed).toBe(0)
  })

  it('should keep the list untouched and pass the backend code through when the write fails', async () => {
    const store = useBasicWordsStore()
    await store.fetchList()

    setBasicWordMark.mockRejectedValueOnce(
      new BusinessError(
        '“book”已经在你的词库里（已掌握），请到词汇页修改它的状态。',
        'BASIC_WORD_ALREADY_LEARNED',
      ),
    )

    const result = await store.setMark('book', 'known')

    expect(result).toMatchObject({ ok: false, code: 'BASIC_WORD_ALREADY_LEARNED' })
    expect(result.message).toContain('词汇页')
    expect(fetchBasicWords).toHaveBeenCalledTimes(1)
    expect(store.error).toBe('')
    expect(store.items).toHaveLength(2)
    expect(store.pendingWord).toBe('')
  })
})

describe('basic words store · 重置', () => {
  it('should go back to the basic group, all statuses and 100 per page', async () => {
    const store = useBasicWordsStore()
    await store.setGroup('calendar')
    await store.setStatus('known')

    store.reset()

    expect(store.group).toBe('basic')
    expect(store.status).toBe('all')
    expect(store.page).toBe(1)
    expect(store.pageSize).toBe(100)
    expect(store.items).toEqual([])
    expect(store.counts).toBeNull()
  })
})
