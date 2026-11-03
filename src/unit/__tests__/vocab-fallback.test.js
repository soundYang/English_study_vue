/**
 * 词源兜底读取测试
 * 后端只在该次生成真的补过词时带 `used: true`（md/60 §5.6）；
 * 前端只认这一种形状，文案原样透传。
 */
import { describe, expect, it } from 'vitest'
import { vocabFallbackOf } from '../vocab-fallback'

function record(overrides = {}) {
  return {
    used: true,
    requestedScope: ['today_new'],
    scopeAvailable: 0,
    allAvailable: 20,
    needed: 15,
    supplemented: 15,
    message: '「今天新学」没有可用词，已从「全部词汇」补充 15 个候选词。',
    ...overrides,
  }
}

describe('vocabFallbackOf', () => {
  it('should read the task / reading shape', () => {
    expect(vocabFallbackOf({ vocabFallback: record() })).toMatchObject({
      used: true,
      supplemented: 15,
    })
  })

  it('should read the per-level capacity shape', () => {
    expect(vocabFallbackOf({ fallback: record() })).toMatchObject({ used: true, needed: 15 })
  })

  it('should stay silent unless the backend actually used the fallback', () => {
    expect(vocabFallbackOf({ vocabFallback: record({ used: false }) })).toBeNull()
    expect(vocabFallbackOf({ vocabFallback: null })).toBeNull()
    expect(vocabFallbackOf({})).toBeNull()
    expect(vocabFallbackOf(null)).toBeNull()
  })

  it('should ignore a record without a usable message', () => {
    expect(vocabFallbackOf({ vocabFallback: record({ message: '   ' }) })).toBeNull()
    expect(vocabFallbackOf({ vocabFallback: record({ message: null }) })).toBeNull()
  })

  it('should trim the message and keep the rest of the record', () => {
    const result = vocabFallbackOf({
      vocabFallback: record({ message: '  已从「全部词汇」补充 15 个候选词。  ' }),
    })

    expect(result.message).toBe('已从「全部词汇」补充 15 个候选词。')
    expect(result.requestedScope).toEqual(['today_new'])
    expect(result.allAvailable).toBe(20)
  })
})
