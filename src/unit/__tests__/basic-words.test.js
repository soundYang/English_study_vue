/**
 * 基础词表映射测试
 * 卡片三态、类型优先级、释义回退与菜单动作都是展示口径，改坏一个就会误导用户（md/52）。
 */
import { describe, expect, it } from 'vitest'
import {
  BASIC_GROUPS,
  BASIC_PAGE_SIZE_OPTIONS,
  BASIC_PAGE_SIZES,
  BASIC_STATUS_OPTIONS,
  meaningOf,
  menuActionsOf,
  metaOf,
  statusOf,
} from '../basic-words'

const PLAIN = {
  word: 'abandon',
  kinds: ['basic'],
  isFunctionWord: false,
  removable: true,
  personalState: 'untouched',
  knownSource: null,
  personalStatus: null,
  summary: '放弃；抛弃',
  senses: [{ pos: 'v.', meaning: '放弃；抛弃' }],
  calendarType: null,
}

describe('statusOf', () => {
  it('should map personalState straight to the three states', () => {
    expect(statusOf(PLAIN)).toEqual({ value: 'unknown', label: '未标记' })
    expect(statusOf({ ...PLAIN, personalState: 'known', knownSource: 'mark' })).toEqual({
      value: 'mastered',
      label: '认识',
    })
    expect(statusOf({ ...PLAIN, personalState: 'known', knownSource: 'library' })).toEqual({
      value: 'mastered',
      label: '认识',
    })
    expect(statusOf({ ...PLAIN, personalState: 'removed' })).toEqual({
      value: 'removed',
      label: '不认识',
    })
  })

  it('should not guess from the legacy personalStatus field', () => {
    // 老字段还在（先后端后前端发布），但页面的口径只看 personalState
    expect(statusOf({ ...PLAIN, personalStatus: 'mastered' })).toEqual({
      value: 'unknown',
      label: '未标记',
    })
  })
})

describe('metaOf', () => {
  it('should still badge a plain content word as 基础词', () => {
    // md/52：每张卡都有徽标，不再有占位空格
    expect(metaOf(PLAIN)).toMatchObject({ label: '基础词' })
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
    expect(metaOf(may).label).toBe('功能词')
    expect(metaOf(may).hint).toContain('文章里必须用到')
  })

  it('should label abbreviations before calendar words', () => {
    expect(metaOf({ ...PLAIN, kinds: ['abbreviation'], removable: false }).label).toBe('缩写')
  })

  it('should label every calendar word as 日期词 and explain which kind it is', () => {
    const weekday = metaOf({
      ...PLAIN,
      kinds: ['calendar'],
      removable: false,
      calendarType: 'weekday',
    })
    const month = metaOf({ ...PLAIN, kinds: ['calendar'], removable: false, calendarType: 'month' })

    expect(weekday.label).toBe('日期词')
    expect(weekday.hint).toContain('星期')
    expect(month.label).toBe('日期词')
    expect(month.hint).toContain('月份')
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

describe('menuActionsOf', () => {
  it('should offer both marks for untouched removable words', () => {
    expect(menuActionsOf(PLAIN).map((action) => action.type)).toEqual(['known', 'unknown'])
  })

  it('should offer known and none for words marked as unknown', () => {
    const actions = menuActionsOf({ ...PLAIN, personalState: 'removed' })

    expect(actions.map((action) => action.type)).toEqual(['known', 'none'])
    expect(actions[1].label).toBe('取消标记')
  })

  it('should offer unknown and none for words marked as known', () => {
    const actions = menuActionsOf({ ...PLAIN, personalState: 'known', knownSource: 'mark' })

    expect(actions.map((action) => action.type)).toEqual(['unknown', 'none'])
    expect(actions[1].label).toBe('取消认识')
  })

  it('should lock words that already live in the personal list', () => {
    // 这类词走 PATCH 会 409，模板不该让用户点了才看到错误
    const actions = menuActionsOf({ ...PLAIN, personalState: 'known', knownSource: 'library' })

    expect(actions).toEqual([{ type: 'locked', label: '已在词库中，去我的单词修改' }])
  })

  it('should render no menu at all for read-only words', () => {
    expect(menuActionsOf({ ...PLAIN, removable: false, isFunctionWord: true })).toBeNull()
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
    // md/52：known 同时包含手动标记与词库中的词，叫「认识」更贴切
    expect(BASIC_STATUS_OPTIONS.find((option) => option.value === 'known').label).toBe('认识')
  })

  it('should default to 100 per page and keep 50 as the only alternative', () => {
    expect(BASIC_PAGE_SIZES).toEqual([100, 50])
    expect(BASIC_PAGE_SIZE_OPTIONS[0]).toEqual({ value: 100, label: '每页 100 条' })
  })
})
