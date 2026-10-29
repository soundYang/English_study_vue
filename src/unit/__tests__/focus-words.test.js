/**
 * 自选单词的纯函数
 * 上限跟篇幅走；空选择不能变成 `focusWords: []`（后端会 400）。
 */
import { describe, expect, it } from 'vitest'
import {
  FOCUS_WORD_RATIO,
  focusWordLimit,
  focusWordsPayload,
  isFocusWordsFull,
  normalizeFocusWords,
} from '../focus-words'

describe('focusWordLimit', () => {
  it('should follow the backend ratio of one word per ten', () => {
    expect(FOCUS_WORD_RATIO).toBe(0.1)
    expect(focusWordLimit(100)).toBe(10)
    expect(focusWordLimit(300)).toBe(30)
    expect(focusWordLimit(1000)).toBe(100)
  })

  it('should round like the backend and refuse non-numeric input', () => {
    expect(focusWordLimit(155)).toBe(16)
    expect(focusWordLimit(0)).toBe(0)
    expect(focusWordLimit('abc')).toBe(0)
    expect(focusWordLimit(null)).toBe(0)
  })
})

describe('normalizeFocusWords', () => {
  it('should trim, dedupe by case and keep first-seen order', () => {
    expect(normalizeFocusWords([' Apple ', 'apple', 'Book', '', null, 'BOOK'])).toEqual([
      'Apple',
      'Book',
    ])
  })

  it('should cut the list at the limit', () => {
    expect(normalizeFocusWords(['a', 'b', 'c'], { limit: 2 })).toEqual(['a', 'b'])
    expect(normalizeFocusWords(['a'], { limit: 0 })).toEqual([])
  })

  it('should survive dirty stored values', () => {
    expect(normalizeFocusWords(null)).toEqual([])
    expect(normalizeFocusWords('apple')).toEqual([])
    expect(normalizeFocusWords([123, undefined])).toEqual(['123'])
  })
})

describe('focusWordsPayload', () => {
  it('should omit the key entirely when nothing is selected', () => {
    // 发 [] 会 400；静默退回自动又会让用户以为选择生效了（md/54 §3.2）
    expect(focusWordsPayload([])).toEqual({})
    expect(focusWordsPayload([''])).toEqual({})
  })

  it('should send the normalized list when words are selected', () => {
    expect(focusWordsPayload([' Apple ', 'apple', 'book'])).toEqual({
      focusWords: ['Apple', 'book'],
    })
  })
})

describe('isFocusWordsFull', () => {
  it('should only count unique words', () => {
    expect(isFocusWordsFull(['apple', 'Apple'], 1)).toBe(true)
    expect(isFocusWordsFull(['apple'], 2)).toBe(false)
    expect(isFocusWordsFull([], 0)).toBe(true)
  })
})
