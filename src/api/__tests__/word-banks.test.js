/**
 * 可选词库接口测试（mock 适配器）
 * 锁住概要口径、目录字段、导入分类、整库分批、批量改状态与重置的边界。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resetMockDb, setMockLatency } from '../../mock/adapter'
import {
  addWordsToBank,
  batchUpdateBankStatus,
  fetchWordBankWords,
  fetchWordBanks,
  resetWordBank,
} from '../word-banks'

beforeEach(() => {
  localStorage.clear()
  resetMockDb()
  setMockLatency(0)
})

async function highBank() {
  const data = await fetchWordBanks()
  return data.banks.find((bank) => bank.key === 'high')
}

describe('word banks api', () => {
  it('should summarize both banks with a shared remaining slot count', async () => {
    const data = await fetchWordBanks()

    expect(data.banks).toHaveLength(2)
    expect(data.banks.map((bank) => bank.key)).toEqual(['high', 'mid'])
    const high = data.banks[0]
    expect(high.label).toBe('高频词库')
    expect(high.total).toBeGreaterThan(0)
    expect(high.imported).toBe(0)
    // 个人词库 24 个种子词，上限 8000
    expect(high.remainingSlots).toBe(8000 - 24)
    expect(data.banks[1].remainingSlots).toBe(high.remainingSlots)
  })

  it('should list catalog words with personal state and the imported flag', async () => {
    const data = await fetchWordBankWords('high', { page: 1, pageSize: 100 })

    expect(data.bank).toMatchObject({ key: 'high', label: '高频词库' })
    expect(data.items).toHaveLength(data.total)
    expect(data.page).toBe(1)
    expect(data.pageSize).toBe(100)
    expect(data.total).toBeGreaterThan(10)

    const apple = data.items.find((item) => item.word === 'apple')
    expect(apple).toMatchObject({
      inLibrary: true,
      // 种子词是本机原有的，不是从词库导入的
      imported: false,
      personalStatus: 'mastered',
    })
    expect(apple.phonetic.uk).toBeTruthy()
    expect(apple.senses.length).toBeGreaterThan(0)
    expect(apple.summary).toBeTruthy()
  })

  it('should search by word or Chinese meaning and filter by imported state', async () => {
    const byWord = await fetchWordBankWords('high', { q: 'aband' })
    expect(byWord.items.map((item) => item.word)).toEqual(['abandon'])

    const byMeaning = await fetchWordBankWords('high', { q: '放弃' })
    expect(byMeaning.items.map((item) => item.word)).toContain('abandon')

    await addWordsToBank('high', { words: ['abandon'] })

    const imported = await fetchWordBankWords('high', { filter: 'imported' })
    expect(imported.items.map((item) => item.word)).toEqual(['abandon'])

    const notImported = await fetchWordBankWords('high', { filter: 'not_imported' })
    expect(notImported.items.map((item) => item.word)).not.toContain('abandon')
  })

  it('should create new words and record the bank membership', async () => {
    const result = await addWordsToBank('high', { words: ['ABANDON'] })

    expect(result).toMatchObject({
      created: 1,
      existing: 0,
      alreadyImported: 0,
      failed: 0,
      done: true,
      limitReached: false,
    })
    expect(result.counts.imported).toBe(1)

    const words = await fetchWordBankWords('high', { filter: 'imported' })
    expect(words.items[0]).toMatchObject({
      word: 'abandon',
      inLibrary: true,
      imported: true,
      // 今天新建的词属于「新词」，明天才转「复习中」
      personalStudyState: 'new',
    })
    expect(words.items[0].wordId).toBeTruthy()

    const summary = await fetchWordBanks()
    expect(summary.banks[0].imported).toBe(1)
    expect(summary.banks[0].importedInLibrary).toBe(1)
    expect(summary.banks[0].remainingSlots).toBe(8000 - 25)
  })

  it('should count user-owned words as existing and never tag them', async () => {
    const result = await addWordsToBank('high', { words: ['apple'] })

    expect(result).toMatchObject({ created: 0, existing: 1, alreadyImported: 0 })
    const summary = await fetchWordBanks()
    expect(summary.banks[0].imported).toBe(0)
    expect(summary.banks[0].remainingSlots).toBe(8000 - 24)
  })

  it('should explain skipped words', async () => {
    const result = await addWordsToBank('high', { words: ['about', 'zzzz', 'bad word'] })

    expect(result.created).toBe(0)
    expect(result.skipped).toEqual(
      expect.arrayContaining([
        { word: 'about', reason: 'BASIC_WORD_EXCLUDED' },
        { word: 'zzzz', reason: 'NOT_IN_BANK' },
        { word: 'bad word', reason: 'INVALID_WORD' },
      ]),
    )
  })

  it('should page through a whole-bank import with cursor and limit', async () => {
    const first = await addWordsToBank('high', { all: true, cursor: 0, limit: 5 })

    expect(first.requested).toBe(5)
    expect(first.nextCursor).toBe(5)
    expect(first.done).toBe(false)

    let cursor = first.nextCursor
    let created = first.created
    let done = first.done

    while (!done) {
      const next = await addWordsToBank('high', { all: true, cursor, limit: 500 })
      created += next.created
      cursor = next.nextCursor
      done = next.done
    }

    expect(created).toBeGreaterThan(0)
    expect(cursor).toBe(await highCatalogTotal())
    const summary = await fetchWordBanks()
    expect(summary.banks[0].imported).toBe(created)
  })

  it('should change only imported words and keep them in the imported tab', async () => {
    await addWordsToBank('high', { words: ['abandon'] })

    const result = await batchUpdateBankStatus('high', {
      words: ['abandon', 'apple'],
      target: 'removed',
    })

    expect(result.updated).toBe(1)
    expect(result.notInBank).toEqual(['apple'])
    expect(result.words[0]).toMatchObject({ word: 'abandon', studyState: 'removed' })
    expect(result.words[0].wordBanks).toEqual(['high'])

    // 标为「不认识」只是学习状态，不会删导入记录
    const imported = await fetchWordBankWords('high', { filter: 'imported' })
    expect(imported.items.map((item) => item.word)).toEqual(['abandon'])
    expect(imported.items[0].personalStudyState).toBe('removed')
  })

  it('should reset only words created by this bank', async () => {
    await addWordsToBank('high', { words: ['abandon', 'apple'] })

    const result = await resetWordBank('high', { confirm: true })

    expect(result).toMatchObject({ removedWords: 1, keptWords: 0, removedMemberships: 1 })
    const summary = await fetchWordBanks()
    expect(summary.banks[0].imported).toBe(0)

    const catalog = await fetchWordBankWords('high', { q: 'abandon' })
    expect(catalog.items[0]).toMatchObject({ inLibrary: false, imported: false })
  })

  it('should reject reset without confirmation', async () => {
    await expect(resetWordBank('high', { confirm: false })).rejects.toMatchObject({
      error: { code: 'INVALID_REQUEST', field: 'confirm' },
    })
  })

  it('should reject an unknown bank with WORD_BANK_NOT_FOUND', async () => {
    await expect(fetchWordBankWords('unknown')).rejects.toMatchObject({
      error: { code: 'WORD_BANK_NOT_FOUND' },
    })
  })
})

async function highCatalogTotal() {
  const data = await fetchWordBanks()
  return data.banks[0].total
}
