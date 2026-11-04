/**
 * 可选词库 store 测试
 * 覆盖概要 / 目录 / Tab、显式导入、整库分批进度、批量改状态与重置后的对账。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { resetMockDb, setMockLatency } from '../../mock/adapter'
import { useWordBanksStore } from '../model/word-banks'
import { useWordsStore } from '../model/words'

beforeEach(() => {
  localStorage.clear()
  resetMockDb()
  setMockLatency(0)
  setActivePinia(createPinia())
})

describe('word banks store', () => {
  it('should load the summary and open a bank on the not-imported tab', async () => {
    const store = useWordBanksStore()

    await store.fetchBanks()
    expect(store.banks).toHaveLength(2)
    expect(store.banks[0].key).toBe('high')

    await store.openBank('high')

    expect(store.bank.key).toBe('high')
    expect(store.tab).toBe('not_imported')
    expect(store.items.length).toBeGreaterThan(0)
    expect(store.importedCount).toBe(0)
    expect(store.notImportedCount).toBe(store.bank.total)
  })

  it('should search and switch to the imported tab', async () => {
    const store = useWordBanksStore()
    await store.fetchBanks()
    await store.openBank('high')

    await store.search('aband')
    expect(store.items.map((item) => item.word)).toEqual(['abandon'])

    await store.search('')
    await store.importWords(['abandon'])
    await store.setTab('imported')

    expect(store.tab).toBe('imported')
    expect(store.items.map((item) => item.word)).toEqual(['abandon'])
    expect(store.importedCount).toBe(1)
  })

  it('should import selected words and refresh the word list', async () => {
    const words = useWordsStore()
    const store = useWordBanksStore()
    await words.fetchList()
    await store.fetchBanks()
    await store.openBank('high')

    const result = await store.importWords(['abandon', 'apple'])

    expect(result).toMatchObject({ ok: true, created: 1, existing: 1 })
    expect(store.importedCount).toBe(1)
    // words store 已经加载过，导入后应静默对账
    expect(words.total).toBe(25)
    expect(words.items.find((item) => item.word === 'abandon').wordBanks).toEqual(['high'])
  })

  it('should import a whole bank in batches and report progress', async () => {
    const store = useWordBanksStore()
    await store.fetchBanks()
    await store.openBank('high')
    const total = store.bank.total

    const result = await store.importAll()

    expect(result.ok).toBe(true)
    expect(result.data.running).toBe(false)
    expect(result.data.done).toBe(total)
    expect(result.data.created).toBeGreaterThan(0)
    expect(store.importProgress.created).toBe(result.data.created)
    expect(store.importedCount).toBe(result.data.created)
    expect(store.importProgress.limitReached).toBe(false)
  })

  it('should batch change imported status and keep the rows in the tab', async () => {
    const store = useWordBanksStore()
    await store.fetchBanks()
    await store.openBank('high')
    await store.importWords(['abandon'])
    await store.setTab('imported')

    const result = await store.batchStatus(['abandon'], 'removed')

    expect(result).toMatchObject({ ok: true, updated: 1 })
    expect(store.items.map((item) => item.word)).toEqual(['abandon'])
    expect(store.items[0].personalStudyState).toBe('removed')
  })

  it('should reset a bank from the overview without opening it', async () => {
    const store = useWordBanksStore()
    await store.fetchBanks()
    await store.openBank('high')
    await store.importWords(['abandon'])

    const result = await store.resetBank('high')

    expect(result).toMatchObject({ ok: true, removedWords: 1 })
    expect(store.banks[0].imported).toBe(0)
  })
})
