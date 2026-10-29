/**
 * 路径片段编码测试
 * 拼进 URL 的值一旦带 `/`、`?`、`#` 就会改掉路由本身，这里锁住编码行为（md/40 L-1）。
 */
import { describe, expect, it } from 'vitest'
import { pathSegment } from '../path'

describe('pathSegment', () => {
  it('should leave ordinary ids untouched', () => {
    expect(pathSegment('6a1f0c9e8b7d4a0012345678')).toBe('6a1f0c9e8b7d4a0012345678')
    expect(pathSegment('t_1')).toBe('t_1')
  })

  it('should encode characters that would change the route', () => {
    expect(pathSegment('a/b')).toBe('a%2Fb')
    expect(pathSegment('x?y=1')).toBe('x%3Fy%3D1')
    expect(pathSegment('a#b')).toBe('a%23b')
    expect(pathSegment('../admin')).toBe('..%2Fadmin')
  })

  it('should encode non-ASCII words the same way the API expects', () => {
    expect(pathSegment('单词')).toBe('%E5%8D%95%E8%AF%8D')
    expect(pathSegment('ice cream')).toBe('ice%20cream')
  })

  it('should treat missing values as an empty segment', () => {
    expect(pathSegment(null)).toBe('')
    expect(pathSegment(undefined)).toBe('')
    expect(pathSegment(0)).toBe('0')
  })
})
