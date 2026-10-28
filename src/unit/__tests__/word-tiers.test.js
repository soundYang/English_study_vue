/**
 * 词频分档测试
 * 阈值是展示口径，边界与「手填词为 null」两件事必须固定住。
 */
import { describe, expect, it } from 'vitest'
import { COCA_TIERS, frequencyTierOf } from '../word-tiers'

describe('frequencyTierOf', () => {
  it('should split ranks into high, mid and low', () => {
    expect(frequencyTierOf(1).key).toBe('high')
    expect(frequencyTierOf(3000).key).toBe('high')
    expect(frequencyTierOf(3001).key).toBe('mid')
    expect(frequencyTierOf(8000).key).toBe('mid')
    expect(frequencyTierOf(8001).key).toBe('low')
    expect(frequencyTierOf(17629).key).toBe('low')
  })

  it('should treat missing or invalid ranks as unknown', () => {
    // 手填词是 null；0 会被误读成「最高频」，因此一并排除
    expect(frequencyTierOf(null)).toBeNull()
    expect(frequencyTierOf(0)).toBeNull()
    expect(frequencyTierOf(-3)).toBeNull()
    expect(frequencyTierOf(undefined)).toBeNull()
  })

  it('should keep the tiers ordered from common to rare', () => {
    expect(COCA_TIERS.map((tier) => tier.label)).toEqual(['高频', '中频', '低频'])
    expect(COCA_TIERS[COCA_TIERS.length - 1].max).toBe(Infinity)
  })
})
