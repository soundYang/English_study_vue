/**
 * 题型标签测试
 * 覆盖后端四种官方题型的文案，以及缺失 / 未知题型不兜底。
 */
import { describe, expect, it } from 'vitest'
import { QUESTION_TYPE_LABELS, questionTypeLabel } from '../question-types'

describe('questionTypeLabel', () => {
  it('should map the four backend types to Chinese labels', () => {
    expect(QUESTION_TYPE_LABELS).toEqual({
      detail: '细节题',
      paraphrase: '释义题',
      inference: '推断题',
      main_idea: '主旨题',
    })
    expect(questionTypeLabel('detail')).toBe('细节题')
    expect(questionTypeLabel('main_idea')).toBe('主旨题')
  })

  it('should return an empty label for old or unknown types', () => {
    expect(questionTypeLabel(null)).toBe('')
    expect(questionTypeLabel(undefined)).toBe('')
    expect(questionTypeLabel('')).toBe('')
    expect(questionTypeLabel('summary')).toBe('')
    expect(questionTypeLabel('constructor')).toBe('')
  })
})
