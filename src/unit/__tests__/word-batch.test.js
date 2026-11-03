/**
 * 批量改状态展示辅助测试
 * 覆盖目标下拉收敛、结果文案的三类分支与未知跳过原因回落。
 */
import { describe, expect, it } from 'vitest'
import {
  batchResultMessage,
  batchResultType,
  batchTargetLabel,
  batchTargetOptionsOf,
} from '../word-batch'

describe('word-batch helpers', () => {
  it('should offer learning / mastered / removed outside the removed tab', () => {
    const values = batchTargetOptionsOf('all').map((option) => option.value)

    expect(values).toEqual(['learning', 'mastered', 'removed'])
    expect(batchTargetOptionsOf('new').map((option) => option.value)).toEqual(values)
  })

  it('should only offer restore on the removed tab', () => {
    expect(batchTargetOptionsOf('removed')).toEqual([{ value: 'restore', label: '恢复' }])
  })

  it('should label unknown targets with the raw value', () => {
    expect(batchTargetLabel('mastered')).toBe('已掌握')
    expect(batchTargetLabel('archived')).toBe('archived')
  })

  it('should summarize updated / unchanged / skipped results', () => {
    const message = batchResultMessage({
      updated: 2,
      unchanged: 1,
      skipped: [
        { id: 'w1', word: 'the', reason: 'FUNCTION_WORD_IMMUTABLE' },
        { id: 'w2', word: '2026', reason: 'BASIC_WORD_READONLY' },
        { id: 'w3', word: 'gone', reason: 'NOT_FOUND' },
      ],
    })

    expect(message).toBe(
      '已更新 2 个词，1 个未变化，跳过 3 个（功能词不可移除 1 个、只读词不可移除 1 个、词不存在 1 个）',
    )
  })

  it('should fall back to 已跳过 for unknown skip reasons', () => {
    const message = batchResultMessage({
      updated: 0,
      unchanged: 0,
      skipped: [{ id: 'w1', word: 'apple', reason: 'SOMETHING_NEW' }],
    })

    expect(message).toBe('跳过 1 个（已跳过 1 个）')
  })

  it('should report no-op batches without claiming success', () => {
    expect(batchResultMessage({ updated: 0, unchanged: 2, skipped: [] })).toBe('2 个未变化')
    expect(batchResultMessage({})).toBe('没有需要修改的词')
    expect(batchResultType({ updated: 1 })).toBe('success')
    expect(batchResultType({ updated: 0, unchanged: 2 })).toBe('info')
  })
})
