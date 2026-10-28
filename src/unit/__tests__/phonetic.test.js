/**
 * 音标拆分测试
 * 表格与卡片共用这一份；三种输入（双写、同写、缺失）必须稳定。
 */
import { describe, expect, it } from 'vitest'
import { phoneticParts } from '../phonetic'

describe('phoneticParts', () => {
  it('should split two accents when they differ', () => {
    const parts = phoneticParts({ uk: '/təˈmɑː.təʊ/', us: '/təˈmeɪ.toʊ/' })

    expect(parts).toEqual([
      { label: '英', value: '/təˈmɑː.təʊ/' },
      { label: '美', value: '/təˈmeɪ.toʊ/' },
    ])
  })

  it('should keep one part when both accents are identical', () => {
    expect(phoneticParts({ uk: '/ˈæp.əl/', us: '/ˈæp.əl/' })).toHaveLength(1)
  })

  it('should fall back to the other accent when one is missing', () => {
    expect(phoneticParts({ uk: null, us: '/bʊk/' })).toEqual([{ label: '英', value: '/bʊk/' }])
    expect(phoneticParts({ uk: '/bʊk/', us: null })).toEqual([{ label: '英', value: '/bʊk/' }])
  })

  it('should return an empty list when there is no phonetic at all', () => {
    expect(phoneticParts(null)).toEqual([])
    expect(phoneticParts({})).toEqual([])
    expect(phoneticParts({ uk: '', us: '' })).toEqual([])
  })
})
