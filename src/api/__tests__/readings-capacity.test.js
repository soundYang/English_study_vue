/**
 * 预检接口测试
 * /capacity 是设置页与首页的唯一口径来源：三档门禁、可用词数与篇幅上限。
 * mock 的数字是近似公式，这里锁的是字段形状与门禁判定，不是具体数值。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { fetchCapacity } from '../readings'
import { resetMockDb, setMockLatency } from '../../mock/adapter'

beforeEach(() => {
  localStorage.clear()
  resetMockDb()
  setMockLatency(0)
})

describe('fetchCapacity', () => {
  it('should return the three gates for every level', async () => {
    const data = await fetchCapacity({ targetWords: 200 })

    expect(Object.keys(data.levels)).toEqual(['easy', 'medium', 'hard'])
    expect(data.levels.easy.maxTargetWords).toBe(300)
    expect(data.levels.hard.maxTargetWords).toBe(600)
    // label 前端暂不消费，但缺了会让下次新增字段时误判成「已经对上了」
    expect(data.wordRange.label).toContain('词')
    expect(data.acceptedRange.label).toContain('词')
  })

  it('should report the shortage of usable words for the length', async () => {
    // 种子库有 20 个学习中 / 已掌握词；200 词按 15% 约需 30 个
    const data = await fetchCapacity({ targetWords: 200 })

    expect(data.available).toBe(20)
    expect(data.levels.easy.required).toBe(30)
    expect(data.levels.easy.shortage).toBe(10)
    expect(data.levels.easy.sufficient).toBe(false)
  })

  it('should tell how many known words each level still needs', async () => {
    const data = await fetchCapacity({ targetWords: 100 })

    // 个人词库 + 该档基础词表：简单 20 + 600 = 620，离 1000 还差 380
    expect(data.levels.easy.knownWords).toBe(620)
    expect(data.levels.easy.knownSufficient).toBe(false)
    expect(data.levels.easy.knownShortage).toBe(380)
  })

  it('should reject a length outside the backend range', async () => {
    await expect(fetchCapacity({ targetWords: 55 })).rejects.toMatchObject({
      status: 400,
      error: { code: 'INVALID_REQUEST', field: 'targetWords' },
    })
  })
})
