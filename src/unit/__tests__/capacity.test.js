/**
 * 预检门禁解读测试
 * /capacity 的字段是后端三道门的合并结果（md/30 §7），这里锁的是「哪一道门先说」
 * 以及设置页 / 难度卡各自的文案，不锁具体数字的来源。
 */
import { describe, expect, it } from 'vitest'
import {
  blockReasonOf,
  capacityNoteOf,
  difficultyNoteOf,
  finalModeNoteOf,
  knownShortageOf,
  vocabMeterOf,
} from '../capacity'

// 与后端 levels[level] 同形：已知词 638、写 100 词的下限 633、上限 300
const GATE = {
  required: 15,
  sufficient: true,
  shortage: 0,
  available: 20,
  knownWords: 638,
  personalWords: 20,
  minKnown: 633,
  unknownBudget: 0,
  maxTargetWords: 300,
  targetWordsAllowed: true,
  finalMode: { supported: false, unlocked: false, unlockAt: 3000, shortage: 2980, active: false },
}

describe('knownShortageOf', () => {
  it('should return the gap between minKnown and knownWords', () => {
    expect(knownShortageOf({ ...GATE, minKnown: 704 })).toBe(66)
  })

  it('should ignore the gate in final mode', () => {
    expect(knownShortageOf({ ...GATE, minKnown: 3618, finalMode: { active: true } })).toBe(0)
  })

  it('should stay silent when the fields are missing', () => {
    expect(knownShortageOf({})).toBe(0)
    expect(knownShortageOf(null)).toBe(0)
  })
})

describe('blockReasonOf', () => {
  it('should pass when every gate is clear', () => {
    expect(blockReasonOf(GATE)).toBeNull()
  })

  it('should report the level cap before the known-words gate', () => {
    // 后端按「上限 → 已知词 → 候选池」的顺序拦截，前端不能倒过来
    const block = blockReasonOf({ ...GATE, targetWordsAllowed: false, minKnown: 704 })

    expect(block).toMatchObject({ kind: 'level_cap', maxTargetWords: 300 })
  })

  it('should report the known-words gate before the candidate pool', () => {
    const block = blockReasonOf({ ...GATE, minKnown: 704, sufficient: false, shortage: 10 })

    expect(block).toMatchObject({
      kind: 'known_words',
      shortage: 66,
      minKnown: 704,
      knownWords: 638,
    })
  })

  it('should report the candidate pool last', () => {
    const block = blockReasonOf({ ...GATE, sufficient: false, shortage: 10 })

    expect(block).toEqual({ kind: 'target_words', shortage: 10 })
  })

  it('should let final mode through without checking the length gates', () => {
    const gate = {
      ...GATE,
      minKnown: 0,
      maxTargetWords: 1000,
      finalMode: { supported: true, unlocked: true, unlockAt: 3000, shortage: 0, active: true },
    }

    expect(blockReasonOf(gate)).toBeNull()
  })
})

describe('vocabMeterOf', () => {
  it('should measure known words against minKnown for ordinary lengths', () => {
    // 600 词要 1800 个已知词，当前 785 个：44% 是界面要画的那一格
    expect(vocabMeterOf({ ...GATE, knownWords: 785, minKnown: 1800 })).toEqual({
      label: '已知词',
      current: 785,
      target: 1800,
      percent: 44,
      met: false,
    })
  })

  it('should stop the bar at 100% once the target is met', () => {
    expect(vocabMeterOf({ ...GATE, knownWords: 1900, minKnown: 1800 })).toMatchObject({
      percent: 100,
      met: true,
    })
  })

  it('should switch to personal words while a long length waits for final mode', () => {
    // 601+ 未解锁时卡住的是个人词库，此时 minKnown 是折算出来的大数字，不能拿来当分母
    const gate = {
      ...GATE,
      knownWords: 785,
      minKnown: 3618,
      personalWords: 2500,
      maxTargetWords: 600,
      targetWordsAllowed: false,
      finalMode: { supported: true, unlocked: false, unlockAt: 3000, shortage: 500, active: false },
    }

    expect(vocabMeterOf(gate, { unlocked: false, unlockAt: 3000 })).toEqual({
      label: '个人词库',
      current: 2500,
      target: 3000,
      percent: 83,
      met: false,
    })
  })

  it('should use the unlock target once final mode is active', () => {
    const gate = {
      ...GATE,
      minKnown: 0,
      personalWords: 3100,
      maxTargetWords: 1000,
      finalMode: { supported: true, unlocked: true, unlockAt: 3000, shortage: 0, active: true },
    }

    expect(vocabMeterOf(gate, { unlocked: true, unlockAt: 3000 })).toMatchObject({
      label: '个人词库',
      current: 3100,
      target: 3000,
      percent: 100,
      met: true,
    })
  })

  it('should draw nothing without a usable denominator', () => {
    // 门槛为 0（最终模式 / 冷启动）或字段缺失时宁可不画，也不编一个分母
    expect(vocabMeterOf({ ...GATE, minKnown: 0 })).toBeNull()
    expect(vocabMeterOf({})).toBeNull()
    expect(vocabMeterOf(null)).toBeNull()
  })
})

describe('capacityNoteOf', () => {
  it('should describe the writable range when nothing blocks', () => {
    const note = capacityNoteOf(GATE, {
      levelLabel: '简单',
      targetWords: 100,
      wordRangeLabel: '100–115 词',
    })

    expect(note).toEqual({ tone: 'ok', text: '当前难度可写 300 词以内，成文约 100–115 词。' })
  })

  it('should spell out the known-words gap', () => {
    const note = capacityNoteOf(
      { ...GATE, minKnown: 704 },
      { levelLabel: '挑战', targetWords: 600 },
    )

    expect(note.tone).toBe('warn')
    expect(note.text).toBe('挑战写 600 词需要认识约 704 个单词，当前 638 个，还差 66 个。')
  })

  it('should point at the level cap when the length is too long', () => {
    const note = capacityNoteOf({ ...GATE, targetWordsAllowed: false }, { levelLabel: '简单' })

    expect(note.tone).toBe('warn')
    expect(note.text).toContain('简单最多写 300 词')
  })

  it('should suggest shortening when the candidate pool is short', () => {
    const note = capacityNoteOf({ ...GATE, sufficient: false, shortage: 10 }, { targetWords: 200 })

    expect(note.text).toContain('还差 10 个可用词')
  })

  it('should explain an empty reviewed pool instead of suggesting shortening', () => {
    // 今天没复习记录时池子为 0：加词只会进「今天新学」，缩短也已到最短
    const note = capacityNoteOf(
      { ...GATE, available: 0, sufficient: false, shortage: 29 },
      { targetWords: 100, scope: ['today_reviewed'] },
    )

    expect(note.tone).toBe('warn')
    expect(note.text).toContain('今天还没有复习记录')
    expect(note.text).toContain('全部词汇')
    expect(note.text).not.toContain('缩短')
  })

  it('should explain an empty new-words pool on its own', () => {
    const note = capacityNoteOf(
      { ...GATE, available: 0, sufficient: false, shortage: 29 },
      { targetWords: 100, scope: ['today_new'] },
    )

    expect(note.text).toContain('今天还没有新学的词')
  })

  it('should keep the generic shortage note for the all-vocabulary scope', () => {
    const note = capacityNoteOf(
      { ...GATE, available: 0, sufficient: false, shortage: 10 },
      { targetWords: 200, scope: ['all'] },
    )

    expect(note.text).toContain('还差 10 个可用词')
  })
})

describe('difficultyNoteOf', () => {
  it('should keep the card note short', () => {
    expect(difficultyNoteOf({ ...GATE, minKnown: 704 })).toBe('还差 66 个认识词')
    expect(difficultyNoteOf({ ...GATE, targetWordsAllowed: false })).toBe('最多写 300 词')
  })

  it('should leave the candidate-pool gate to the page-level note', () => {
    // 三张卡同时写「还差 10 个可用词」只会制造噪音，A 门由设置页整句说明
    expect(difficultyNoteOf({ ...GATE, sufficient: false, shortage: 10 })).toBe('')
    expect(difficultyNoteOf(null)).toBe('')
  })
})

describe('finalModeNoteOf', () => {
  it('should say nothing for levels that do not support final mode', () => {
    expect(finalModeNoteOf({ supported: false, unlocked: false })).toBe('')
    expect(finalModeNoteOf(null)).toBe('')
  })

  it('should spell out the personal-words gap when locked', () => {
    expect(
      finalModeNoteOf({ supported: true, unlocked: false, unlockAt: 3000, shortage: 500 }),
    ).toBe('601–1000 词属最终模式，需个人词库 3000 个单词（还差 500 个）。')
  })

  it('should drop the gap when the numbers are missing', () => {
    expect(finalModeNoteOf({ supported: true, unlocked: false })).toBe(
      '601–1000 词属最终模式，需个人词库 3000 个单词。',
    )
  })

  it('should acknowledge the unlocked state', () => {
    expect(finalModeNoteOf({ supported: true, unlocked: true })).toBe(
      '已解锁最终模式：可以写 601–1000 词。',
    )
  })
})
