/**
 * 单词详情映射测试
 * 覆盖基础词的四类词、三态标记 / 已收录 / 功能词的事实行，以及我的单词的两种来源。
 */
import { describe, expect, it } from 'vitest'
import { basicWordDetail, myWordDetail } from '../word-detail'

function makeBasic(overrides = {}) {
  return {
    word: 'abandon',
    kinds: ['basic'],
    isFunctionWord: false,
    removable: true,
    personalState: 'untouched',
    knownSource: null,
    personalStatus: null,
    cocaRank: 2201,
    phonetic: { uk: '/əˈbæn.dən/', us: '/əˈbæn.dɑːn/' },
    senses: [
      { pos: 'v.', meaning: '放弃；抛弃' },
      { pos: 'n.', meaning: '放纵' },
    ],
    summary: '放弃；抛弃',
    expansion: null,
    expansionMeaning: null,
    ...overrides,
  }
}

function factMap(detail) {
  return Object.fromEntries(detail.facts.map((fact) => [fact.label, fact.value]))
}

describe('basicWordDetail', () => {
  it('should list every sense and the basic facts', () => {
    const detail = basicWordDetail(makeBasic())
    const facts = factMap(detail)

    expect(detail.word).toBe('abandon')
    expect(detail.phonetic).toEqual({ uk: '/əˈbæn.dən/', us: '/əˈbæn.dɑːn/' })
    expect(detail.senses).toHaveLength(2)
    expect(detail.senses[1]).toEqual({ pos: 'n.', meaning: '放纵' })
    expect(facts['状态']).toBe('未标记')
    expect(facts['词表']).toBe('基础词')
    expect(facts['词频']).toBe('COCA 2201 · 高频')
    expect(facts['标记']).toBe('可标为认识或不认识')
  })

  it('should join multiple kinds without treating may as calendar only', () => {
    const detail = basicWordDetail(
      makeBasic({
        word: 'may',
        kinds: ['basic', 'calendar'],
        isFunctionWord: true,
        removable: false,
      }),
    )

    expect(factMap(detail)['词表']).toBe('基础词 · 日历词')
    expect(factMap(detail)['标记']).toBe('功能词，不可标记')
  })

  it('should use the Chinese expansion as the only sense of an abbreviation', () => {
    const detail = basicWordDetail(
      makeBasic({
        word: 'USA',
        kinds: ['abbreviation'],
        removable: false,
        phonetic: null,
        senses: [],
        summary: null,
        expansion: 'United States of America',
        expansionMeaning: '美利坚合众国',
      }),
    )
    const facts = factMap(detail)

    expect(detail.senses).toEqual([{ pos: '', meaning: '美利坚合众国' }])
    expect(facts['英文全称']).toBe('United States of America')
    expect(facts['标记']).toBe('只读词，不可标记')
    expect(facts['词频']).toBe('COCA 2201 · 高频')
  })

  it('should mark a removed word as switchable back', () => {
    const facts = factMap(basicWordDetail(makeBasic({ personalState: 'removed' })))

    expect(facts['状态']).toBe('不认识')
    expect(facts['标记']).toBe('已标为不认识，可改回认识或取消')
  })

  it('should describe a manually marked known word as cancellable', () => {
    const facts = factMap(
      basicWordDetail(makeBasic({ personalState: 'known', knownSource: 'mark' })),
    )

    expect(facts['状态']).toBe('认识')
    expect(facts['标记']).toBe('已标为认识，可取消')
  })

  it('should show the personal status and point to my words when learned', () => {
    const facts = factMap(
      basicWordDetail(
        makeBasic({ personalState: 'known', knownSource: 'library', personalStatus: 'mastered' }),
      ),
    )

    expect(facts['状态']).toBe('认识')
    expect(facts['我的单词']).toBe('已掌握')
    expect(facts['标记']).toBe('已在词库中，去我的单词修改')
  })

  it('should omit the COCA row when the word has no rank', () => {
    const facts = factMap(basicWordDetail(makeBasic({ cocaRank: null })))

    expect(facts['词频']).toBeUndefined()
  })
})

describe('myWordDetail', () => {
  it('should map a dictionary word with rank and date', () => {
    const detail = myWordDetail({
      word: 'abandon',
      source: 'dictionary',
      cocaRank: 2201,
      createdAt: '2026-10-01T08:00:00.000Z',
      phonetic: { uk: '/əˈbæn.dən/', us: '/əˈbæn.dən/' },
      senses: [{ pos: 'v.', meaning: '放弃；抛弃' }],
    })
    const facts = factMap(detail)

    expect(detail.senses).toEqual([{ pos: 'v.', meaning: '放弃；抛弃' }])
    expect(facts['来源']).toBe('词库')
    expect(facts['词频']).toBe('COCA 2201 · 高频')
    expect(facts['收录']).toBe('2026-10-01')
  })

  it('should keep a manual word readable without phonetic or rank', () => {
    const detail = myWordDetail({
      word: 'zebra',
      source: 'manual',
      cocaRank: null,
      createdAt: '2026-10-02T08:00:00.000Z',
      phonetic: null,
      senses: [{ pos: '', meaning: '斑马' }],
    })
    const facts = factMap(detail)

    expect(detail.phonetic).toBeNull()
    expect(detail.senses).toEqual([{ pos: '', meaning: '斑马' }])
    expect(facts['来源']).toBe('手填')
    expect(facts['词频']).toBeUndefined()
    expect(facts['收录']).toBe('2026-10-02')
  })
})
