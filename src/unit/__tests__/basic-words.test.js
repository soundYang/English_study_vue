/**
 * 基础词表映射测试
 * 卡片三态、类型优先级、释义回退与菜单动作都是展示口径，改坏一个就会误导用户。
 */
import { describe, expect, it } from 'vitest'
import {
  BASIC_GROUPS,
  BASIC_PAGE_SIZE_OPTIONS,
  BASIC_PAGE_SIZES,
  BASIC_STATUS_OPTIONS,
  meaningOf,
  menuActionOf,
  metaOf,
  statusOf,
} from '../basic-words'

const PLAIN = {
  word: 'abandon',
  kinds: ['basic'],
  isFunctionWord: false,
  removable: true,
  removed: false,
  personalStatus: null,
  summary: '放弃；抛弃',
  senses: [{ pos: 'v.', meaning: '放弃；抛弃' }],
  calendarType: null,
}

describe('statusOf', () => {
  it('should show three states from the two backend fields', () => {
    expect(statusOf({ ...PLAIN })).toEqual({ value: 'unknown', label: '未标记' })
    expect(statusOf({ ...PLAIN, personalStatus: 'learning' })).toEqual({
      value: 'mastered',
      label: '已知',
    })
    expect(statusOf({ ...PLAIN, personalStatus: 'mastered' })).toEqual({
      value: 'mastered',
      label: '已知',
    })
    expect(statusOf({ ...PLAIN, removed: true, personalStatus: 'new' })).toEqual({
      value: 'new',
      label: '不认识',
    })
  })
})

describe('metaOf', () => {
  it('should keep a plain content word without a badge', () => {
    expect(metaOf(PLAIN)).toBeNull()
  })

  it('should label function words before anything else', () => {
    // may 同时是情态动词和五月，kind 是 basic，但它是功能词
    const may = {
      ...PLAIN,
      word: 'may',
      kinds: ['basic', 'calendar'],
      isFunctionWord: true,
      removable: false,
      calendarType: 'month',
    }
    expect(metaOf(may).label).toBe('文章必用')
  })

  it('should label abbreviations and calendar words with their own copy', () => {
    expect(metaOf({ ...PLAIN, kinds: ['abbreviation'], removable: false }).label).toBe('缩写')
    expect(
      metaOf({ ...PLAIN, kinds: ['calendar'], removable: false, calendarType: 'weekday' }).label,
    ).toBe('星期')
    expect(
      metaOf({ ...PLAIN, kinds: ['calendar'], removable: false, calendarType: 'month' }).label,
    ).toBe('月份')
  })
})

describe('meaningOf', () => {
  it('should prefer the backend summary', () => {
    expect(meaningOf(PLAIN)).toBe('放弃；抛弃')
  })

  it('should fall back to the first sense and then to an empty string', () => {
    expect(meaningOf({ ...PLAIN, summary: '' })).toBe('放弃；抛弃')
    expect(meaningOf({ ...PLAIN, summary: '', senses: [] })).toBe('')
    expect(meaningOf({ ...PLAIN, summary: '', senses: null })).toBe('')
  })
})

describe('menuActionOf', () => {
  it('should offer remove only for untouched removable words', () => {
    expect(menuActionOf(PLAIN)).toEqual({ type: 'remove', label: '标为不认识' })
  })

  it('should offer restore for words removed on this page', () => {
    expect(menuActionOf({ ...PLAIN, removed: true, personalStatus: 'new' }).type).toBe('restore')
  })

  it('should lock words that already live in the personal list', () => {
    // 这类词走 DELETE 会 409，模板不该让用户点了才看到错误
    expect(menuActionOf({ ...PLAIN, personalStatus: 'mastered' }).type).toBe('locked')
  })

  it('should render no menu at all for read-only words', () => {
    expect(menuActionOf({ ...PLAIN, removable: false, isFunctionWord: true })).toBeNull()
  })
})

describe('options', () => {
  it('should expose the three groups in tab order', () => {
    expect(BASIC_GROUPS.map((group) => group.value)).toEqual(['basic', 'calendar', 'abbreviation'])
  })

  it('should offer every status filter the backend understands', () => {
    expect(BASIC_STATUS_OPTIONS.map((option) => option.value)).toEqual([
      'all',
      'unknown',
      'known',
      'removed',
    ])
  })

  it('should default to 100 per page and keep 50 as the only alternative', () => {
    expect(BASIC_PAGE_SIZES).toEqual([100, 50])
    expect(BASIC_PAGE_SIZE_OPTIONS[0]).toEqual({ value: 100, label: '每页 100 条' })
  })
})
