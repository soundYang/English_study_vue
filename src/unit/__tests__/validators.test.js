/**
 * 运行时校验测试
 * 重点锁住与后端契约对齐的常量：篇幅区间、步长、三档上限。
 * 这些数字改错不会报错，只会让用户在点「生成」时收到 400。
 */
import { describe, expect, it } from 'vitest'
import {
  LEVEL_MAX_TARGET_WORDS,
  normalizeVocabScope,
  TARGET_WORDS_MAX,
  TARGET_WORDS_MIN,
  TARGET_WORDS_STEP,
  validateSettings,
  VOCAB_SCOPES,
} from '../validators'

const VALID_SETTINGS = { level: 'easy', targetWords: 200, questionCount: 5 }

describe('validateSettings', () => {
  it('should accept a normal payload', () => {
    expect(validateSettings(VALID_SETTINGS).valid).toBe(true)
  })

  it('should reject 50 words because the backend minimum is 100', () => {
    expect(validateSettings({ ...VALID_SETTINGS, targetWords: 50 }).valid).toBe(false)
  })

  it('should accept both ends of the backend range', () => {
    expect(validateSettings({ ...VALID_SETTINGS, targetWords: TARGET_WORDS_MIN }).valid).toBe(true)
    expect(validateSettings({ ...VALID_SETTINGS, targetWords: TARGET_WORDS_MAX }).valid).toBe(true)
  })

  it('should reject 650 words because the backend maximum is 600', () => {
    expect(validateSettings({ ...VALID_SETTINGS, targetWords: 650 }).valid).toBe(false)
  })

  it('should reject a length that is not a multiple of 10', () => {
    expect(validateSettings({ ...VALID_SETTINGS, targetWords: 205 }).valid).toBe(false)
  })

  // 老数据没有这个字段，缺省必须放行，否则升级后整份设置会被判无效
  it('should accept settings without vocabScope', () => {
    expect(validateSettings(VALID_SETTINGS).valid).toBe(true)
  })

  it('should reject an empty or unknown vocabScope', () => {
    expect(validateSettings({ ...VALID_SETTINGS, vocabScope: [] }).errors.vocabScope).toBeTruthy()
    expect(
      validateSettings({ ...VALID_SETTINGS, vocabScope: ['yesterday'] }).errors.vocabScope,
    ).toBeTruthy()
  })

  it('should accept every documented scope on its own', () => {
    VOCAB_SCOPES.forEach((scope) => {
      expect(validateSettings({ ...VALID_SETTINGS, vocabScope: [scope] }).valid).toBe(true)
    })
  })
})

describe('normalizeVocabScope', () => {
  it('should fall back to all for empty input', () => {
    expect(normalizeVocabScope([])).toEqual(['all'])
    expect(normalizeVocabScope(undefined)).toEqual(['all'])
    expect(normalizeVocabScope(['nonsense'])).toEqual(['all'])
  })

  // 后端 normalizeScope 同口径：混进 'all' 就按全量算，不留半全量半具体
  it('should collapse to all when all is present', () => {
    expect(normalizeVocabScope(['all', 'today_new'])).toEqual(['all'])
  })

  it('should keep a deduplicated union of concrete scopes', () => {
    expect(normalizeVocabScope(['today_new', 'today_new', 'today_reviewed'])).toEqual([
      'today_new',
      'today_reviewed',
    ])
  })
})

describe('target word constants', () => {
  it('should stay in sync with the backend schema', () => {
    expect(TARGET_WORDS_MIN).toBe(100)
    expect(TARGET_WORDS_MAX).toBe(600)
    expect(TARGET_WORDS_STEP).toBe(10)
  })

  // 唯一来源是后端 level-limits.js，改那边就要改这里
  it('should stay in sync with level-limits.js', () => {
    expect(LEVEL_MAX_TARGET_WORDS).toEqual({ easy: 300, medium: 450, hard: 600 })
  })

  it('should keep every level cap inside the global range', () => {
    Object.values(LEVEL_MAX_TARGET_WORDS).forEach((max) => {
      expect(max).toBeGreaterThanOrEqual(TARGET_WORDS_MIN)
      expect(max).toBeLessThanOrEqual(TARGET_WORDS_MAX)
    })
  })
})
