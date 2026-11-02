/**
 * 用词释义查询测试
 * 覆盖个人词库优先、精确匹配、词典兜底、空结果缓存、失败重试与旧请求丢弃。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useWordLookup } from '../useWordLookup'

const { fetchWordsMock, searchDictionaryMock } = vi.hoisted(() => ({
  fetchWordsMock: vi.fn(),
  searchDictionaryMock: vi.fn(),
}))

vi.mock('../../api/words', () => ({ fetchWords: fetchWordsMock }))
vi.mock('../../api/dictionary', () => ({ searchDictionary: searchDictionaryMock }))

function setupLookup() {
  let api = null
  const Probe = defineComponent({
    setup() {
      api = useWordLookup()
      return () => null
    },
  })

  mount(Probe)
  return api
}

function wordItem(word, meaning, overrides = {}) {
  return {
    word,
    source: 'dictionary',
    phonetic: null,
    senses: [{ pos: 'n.', meaning }],
    ...overrides,
  }
}

function dictionaryEntry(headword, meaning) {
  return {
    headword,
    phonetic: null,
    senses: [{ pos: 'n.', meaning }],
  }
}

beforeEach(() => {
  fetchWordsMock.mockReset()
  searchDictionaryMock.mockReset()
})

describe('useWordLookup', () => {
  it('should prefer the exact personal word over a prefix match', async () => {
    fetchWordsMock.mockResolvedValue({
      items: [wordItem('article', '文章'), wordItem('art', '艺术')],
    })

    const detail = await setupLookup().lookup('art')

    expect(detail.state).toBe('ready')
    expect(detail.word).toBe('art')
    expect(detail.senses).toEqual([{ pos: 'n.', meaning: '艺术' }])
    expect(searchDictionaryMock).not.toHaveBeenCalled()
  })

  it('should fall back to the dictionary when the personal library has no exact word', async () => {
    fetchWordsMock.mockResolvedValue({ items: [wordItem('article', '文章')] })
    searchDictionaryMock.mockResolvedValue({ items: [dictionaryEntry('zebra', '斑马')] })

    const detail = await setupLookup().lookup('zebra')

    expect(detail.state).toBe('ready')
    expect(detail.word).toBe('zebra')
    expect(detail.senses).toEqual([{ pos: 'n.', meaning: '斑马' }])
    expect(detail.facts).toEqual([{ label: '来源', value: '词库' }])
  })

  it('should fall back to the dictionary when the personal word has no senses', async () => {
    fetchWordsMock.mockResolvedValue({
      items: [wordItem('zebra', '', { senses: [] })],
    })
    searchDictionaryMock.mockResolvedValue({ items: [dictionaryEntry('zebra', '斑马')] })

    const detail = await setupLookup().lookup('zebra')

    expect(detail.senses).toEqual([{ pos: 'n.', meaning: '斑马' }])
  })

  it('should return an explicit empty state and cache it', async () => {
    fetchWordsMock.mockResolvedValue({ items: [] })
    searchDictionaryMock.mockResolvedValue({ items: [] })

    const api = setupLookup()
    const first = await api.lookup('mystery')
    const second = await api.lookup(' MYSTERY ')

    expect(first.state).toBe('empty')
    expect(first.senses).toEqual([])
    expect(second).toBe(first)
    expect(fetchWordsMock).toHaveBeenCalledTimes(1)
    expect(searchDictionaryMock).toHaveBeenCalledTimes(1)
  })

  it('should not cache a failure and should allow a retry', async () => {
    fetchWordsMock.mockRejectedValueOnce(new Error('network down'))
    fetchWordsMock.mockResolvedValueOnce({ items: [wordItem('brave', '勇敢的')] })

    const api = setupLookup()
    const failed = await api.lookup('brave')
    const retried = await api.lookup('brave')

    expect(failed.state).toBe('error')
    expect(failed.message).toContain('再点一次')
    expect(retried.state).toBe('ready')
    expect(retried.senses[0].meaning).toBe('勇敢的')
    expect(fetchWordsMock).toHaveBeenCalledTimes(2)
  })

  it('should ignore an aborted request instead of showing an error', async () => {
    fetchWordsMock.mockRejectedValue({ name: 'CanceledError' })

    await expect(setupLookup().lookup('quiet')).resolves.toBeNull()
  })

  it('should drop a stale response when a newer word is requested', async () => {
    let resolveFirst = null
    fetchWordsMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValueOnce({ items: [wordItem('brave', '勇敢的')] })

    const api = setupLookup()
    const first = api.lookup('courage')
    const second = api.lookup('brave')

    await expect(second).resolves.toMatchObject({ word: 'brave', state: 'ready' })

    resolveFirst({ items: [wordItem('courage', '勇气')] })
    await expect(first).resolves.toBeNull()
  })
})
