/**
 * 错误文案映射测试
 * describeVocabShortage 返回的 actions 是覆盖层按钮的唯一真相，
 * 改这里等于改用户能点的东西，所以三种 kind 各锁一条。
 */
import { describe, expect, it } from 'vitest'
import { describeRateLimit, describeVocabShortage } from '../error-text'

describe('describeVocabShortage', () => {
  it('should explain known-words shortage with the gap', () => {
    // 形状与后端 knownWordsTooSmall 的 details 一致：required / available / shortage
    const result = describeVocabShortage({
      code: 'VOCABULARY_TOO_SMALL',
      details: {
        kind: 'known_words',
        level: 'medium',
        required: 1900,
        available: 1758,
        shortage: 142,
      },
    })

    expect(result.actions).toEqual(['lower', 'add'])
    expect(result.hint).toContain('142')
  })

  it('should explain a target-words shortage with three ways out', () => {
    const result = describeVocabShortage({
      code: 'VOCABULARY_TOO_SMALL',
      details: { kind: 'target_words', required: 30, available: 20, targetWords: 200 },
    })

    expect(result.actions).toEqual(['shorten', 'lower', 'add'])
    expect(result.hint).toContain('10')
  })

  it('should only offer shortening when the level caps the length', () => {
    // 400 INVALID_REQUEST + target_words_cap：不是词不够，是难度上限
    const result = describeVocabShortage({
      code: 'INVALID_REQUEST',
      details: { kind: 'target_words_cap', level: 'easy', targetWords: 600, maxTargetWords: 300 },
    })

    expect(result.actions).toEqual(['shorten'])
    expect(result.hint).toContain('300')
  })

  // 20 词兜底没有 details，只能给通用文案，不能算出差额
  it('should fall back to a known-words hint for the legacy 20-word gate', () => {
    const result = describeVocabShortage({ code: 'INSUFFICIENT_VOCABULARY', details: {} })

    expect(result.kind).toBe('known_words')
    expect(result.actions).toEqual(['lower', 'add'])
  })
})

describe('describeRateLimit', () => {
  it('should say how many requests per window are allowed', () => {
    const result = describeRateLimit({ details: { limit: 20, windowSeconds: 60 } })

    expect(result.title).toBe('生成太频繁了')
    expect(result.hint).toBe('每分钟最多生成 20 次，等一会儿再试。')
  })

  it('should read a non-minute window in seconds', () => {
    const result = describeRateLimit({ details: { limit: 5, windowSeconds: 30 } })

    expect(result.hint).toContain('每 30 秒最多生成 5 次')
  })

  // 窗口长度不是剩余时间：没有 details 时只能说「等一会儿」，不能编一个倒计时
  it('should fall back to a generic hint without details', () => {
    const result = describeRateLimit({})

    expect(result.hint).toContain('等一会儿再试')
    expect(result.hint).not.toContain('分钟')
  })
})
