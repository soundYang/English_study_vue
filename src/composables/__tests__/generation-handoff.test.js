/**
 * 生成交接单测试
 * 锁住「取一次就清空」与参数快照：入口页与生成页之间只传一份，避免返回时重复生成。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearGenerationHandoff,
  hasGenerationHandoff,
  setGenerationHandoff,
  takeGenerationHandoff,
} from '../useGenerationHandoff'

beforeEach(() => {
  clearGenerationHandoff()
})

describe('useGenerationHandoff', () => {
  it('should hand over a snapshot of the payload', () => {
    const payload = { level: 'hard', targetWords: 600, questionCount: 5 }

    setGenerationHandoff(payload, { availableWords: 120, from: '/settings' })
    payload.targetWords = 100

    expect(takeGenerationHandoff()).toEqual({
      payload: { level: 'hard', targetWords: 600, questionCount: 5 },
      availableWords: 120,
      from: '/settings',
    })
  })

  it('should only hand over once', () => {
    setGenerationHandoff({ level: 'easy' }, { from: '/' })

    expect(hasGenerationHandoff()).toBe(true)
    expect(takeGenerationHandoff()).toBeTruthy()
    expect(hasGenerationHandoff()).toBe(false)
    expect(takeGenerationHandoff()).toBeNull()
  })

  it('should fall back to the settings page as the origin', () => {
    setGenerationHandoff({ level: 'easy' })

    expect(takeGenerationHandoff()).toMatchObject({ availableWords: null, from: '/settings' })
  })
})
