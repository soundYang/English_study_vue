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
    // 每档各自的候选池（后端 md/22 §3）：新代码读这里，不再用顶层 available
    expect(data.levels.easy.available).toBe(data.available)
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

  it('should expose the length ladder and the final-mode lock', async () => {
    const data = await fetchCapacity({ targetWords: 100 })

    // 已知词 = 个人词库 20 + 基础词表地板 618；写 100 词的下限是 633
    expect(data.levels.easy.knownWords).toBe(638)
    expect(data.levels.easy.minKnown).toBe(633)
    expect(data.levels.easy.personalWords).toBe(20)
    // md/30 §7 已删除的旧字段不能再回来，否则前端又会悄悄读错
    expect(data.levels.easy.knownSufficient).toBeUndefined()
    expect(data.levels.easy.knownShortage).toBeUndefined()

    // 阶梯固定 100–1000 共 10 行；100 词这一档可以写
    expect(data.levels.easy.lengths).toHaveLength(10)
    expect(data.levels.easy.lengths[0]).toMatchObject({
      targetWords: 100,
      unlocked: true,
      blockedBy: null,
    })
    // 400 词超出 easy 的档位上限
    expect(data.levels.easy.lengths.find((row) => row.targetWords === 400)).toMatchObject({
      unlocked: false,
      blockedBy: 'level_cap',
    })

    // 最终模式未解锁：差额按个人词库算，601+ 的 hard 档标 final_mode
    expect(data.finalMode).toMatchObject({ unlocked: false, unlockAt: 3000, shortage: 2980 })
    expect(data.levels.hard.lengths.find((row) => row.targetWords === 700)).toMatchObject({
      unlocked: false,
      blockedBy: 'final_mode',
      shortage: 2980,
    })
  })

  it('should reject a length outside the backend range', async () => {
    await expect(fetchCapacity({ targetWords: 55 })).rejects.toMatchObject({
      status: 400,
      error: { code: 'INVALID_REQUEST', field: 'targetWords' },
    })
  })
})
