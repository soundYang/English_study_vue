/**
 * 管理端格式化测试
 * 时间固定按 Asia/Shanghai；万 / 亿、空值、额度关闭都是页面上直接看到的数字，
 * 错一个就要管理员自己换算，所以逐条锁住（md/40 §5.1）。
 */
import { describe, expect, it } from 'vitest'
import {
  contactLabel,
  feedbackCategoryLabel,
  feedbackStatusLabel,
  formatCount,
  formatDate,
  formatDateTime,
  formatPercent,
  formatQuota,
  formatTime,
  formatTokens,
  maskPhone,
  readingStatusLabel,
  submitterLabel,
} from '../format'

describe('admin formatDateTime', () => {
  it('should render UTC ISO strings in Beijing time', () => {
    expect(formatDateTime('2026-10-29T01:12:00.000Z')).toBe('2026-10-29 09:12')
    // 跨日：UTC 的前一天 16:00 是北京当天 0 点
    expect(formatDateTime('2026-10-28T16:00:00.000Z')).toBe('2026-10-29 00:00')
  })

  it('should split date and time for two-line cells', () => {
    expect(formatDate('2026-10-29T01:12:00.000Z')).toBe('2026-10-29')
    expect(formatTime('2026-10-29T01:12:00.000Z')).toBe('09:12')
  })

  // 空值、非法值不能让表格出现 Invalid Date 或 NaN
  it('should fall back to a dash for missing or invalid values', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('oops')).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatTime('')).toBe('—')
  })
})

describe('admin number formatting', () => {
  it('should add thousands separators', () => {
    expect(formatCount(1234)).toBe('1,234')
    expect(formatCount(null)).toBe('0')
    expect(formatCount('abc')).toBe('0')
  })

  it('should compact tokens at 万 and 亿', () => {
    expect(formatTokens(9999)).toBe('9,999')
    expect(formatTokens(10000)).toBe('1万')
    expect(formatTokens(1554000)).toBe('155.4万')
    expect(formatTokens(12346000)).toBe('1234.6万')
    expect(formatTokens(200000000)).toBe('2亿')
    expect(formatTokens(123456789)).toBe('1.2亿')
  })

  it('should not invent a percentage with a zero denominator', () => {
    expect(formatPercent(12346000, 200000000)).toBe('6.2%')
    expect(formatPercent(1, 0)).toBe('—')
    expect(formatPercent('x', 10)).toBe('—')
  })
})

describe('admin quota and privacy formatting', () => {
  it('should show 未启用 when the daily quota is off', () => {
    expect(formatQuota({ enabled: false, limit: null, used: null })).toBe('未启用')
  })

  it('should show used over limit when the quota is on', () => {
    expect(formatQuota({ enabled: true, limit: 3, used: 1 })).toBe('1/3')
    // used 为 null 时不能回退成 0/3（md/40 §10 第 5 条）
    expect(formatQuota({ enabled: true, limit: 3, used: null })).toBe('—/3')
  })

  it('should mask the feedback phone snapshot', () => {
    expect(maskPhone('13812348000')).toBe('138****8000')
    expect(maskPhone(null)).toBe('')
    expect(maskPhone('12345')).toBe('12345')
  })

  it('should resolve the submitter with the documented fallback order', () => {
    expect(submitterLabel({ username: 'Tom', userId: 'u_1' })).toBe('Tom')
    expect(submitterLabel({ username: '', userId: 'u_1' })).toBe('u_1')
    expect(submitterLabel({ username: '', userId: 'anonymous' })).toBe('未登录用户')
  })

  it('should prefer the contact field over the masked phone', () => {
    expect(contactLabel({ contact: '微信 abc', phone: '13812348000' })).toBe('微信 abc')
    expect(contactLabel({ contact: '', phone: '13812348000' })).toBe('138****8000')
    expect(contactLabel({})).toBe('—')
  })

  it('should translate feedback and reading enums', () => {
    expect(feedbackCategoryLabel('bug')).toBe('功能异常')
    expect(feedbackStatusLabel('open')).toBe('待处理')
    expect(readingStatusLabel('submitted')).toBe('已提交')
    // 未知值原样显示，不吞掉
    expect(feedbackStatusLabel('archived')).toBe('archived')
  })
})
