/**
 * 正文未学词匹配测试
 * 覆盖原形 / 大小写、常见词形还原、不相关词不误标，以及切片拼回原文不变。
 */
import { describe, expect, it } from 'vitest'
import { annotateParagraph, baseFormsOf, buildLookup } from '../reading-words'

const ENTRIES = [
  { word: 'dramatic', senses: [{ pos: 'adj.', meaning: '戏剧性的' }] },
  { word: 'uncertain', senses: [{ pos: 'adj.', meaning: '不确定的' }] },
  { word: 'abandon', senses: [{ pos: 'v.', meaning: '放弃' }] },
  { word: 'study', senses: [{ pos: 'v.', meaning: '学习' }] },
  { word: 'stop', senses: [{ pos: 'v.', meaning: '停下' }] },
  { word: 'run', senses: [{ pos: 'v.', meaning: '跑' }] },
  { word: 'practice', senses: [{ pos: 'v.', meaning: '练习' }] },
  { word: 'make', senses: [{ pos: 'v.', meaning: '做' }] },
  { word: 'big', senses: [{ pos: 'adj.', meaning: '大的' }] },
  { word: 'quick', senses: [{ pos: 'adj.', meaning: '快的' }] },
]

const lookup = buildLookup(ENTRIES)

function marked(text) {
  return annotateParagraph(text, lookup)
    .filter((token) => token.entry)
    .map((token) => token.text)
}

describe('reading-words · 原形与大小写', () => {
  it('should mark the exact word in any case', () => {
    expect(marked('Nothing dramatic happened.')).toEqual(['dramatic'])
    expect(marked('Dramatic openings sell.')).toEqual(['Dramatic'])
    expect(marked('A DRAMATIC pause.')).toEqual(['DRAMATIC'])
  })

  it('should not mark a word that only shares a prefix or suffix', () => {
    expect(marked('An undramatic and uncertain-looking week.')).toEqual(['uncertain'])
    expect(marked('A dramaticism-free week.')).toEqual([])
  })

  it('should keep every character when the slices are joined back', () => {
    const source = "But most courage is quiet.—It's the student, isn’t it?"
    const tokens = annotateParagraph(source, lookup)

    expect(tokens.map((token) => token.text).join('')).toBe(source)
  })

  it('should mark nothing when the entry list is empty', () => {
    const tokens = annotateParagraph('Nothing dramatic happened.', new Map())

    expect(tokens.some((token) => token.entry)).toBe(false)
    expect(tokens.map((token) => token.text).join('')).toBe('Nothing dramatic happened.')
  })
})

describe('reading-words · 词形还原', () => {
  it('should reduce plurals and third-person forms', () => {
    expect(marked('She studies hard and stops often.')).toEqual(['studies', 'stops'])
  })

  it('should reduce past tense, including e-restore and doubled consonants', () => {
    expect(marked('They abandoned it, practiced daily and stopped.')).toEqual([
      'abandoned',
      'practiced',
      'stopped',
    ])
  })

  it('should reduce progressives, including e-restore and doubled consonants', () => {
    expect(marked('Running, practicing and making progress.')).toEqual([
      'Running',
      'practicing',
      'making',
    ])
  })

  it('should reduce comparatives, superlatives and adverbs', () => {
    expect(marked('A bigger box, the biggest one, quickly done.')).toEqual([
      'bigger',
      'biggest',
      'quickly',
    ])
  })

  it('should keep the original word form as the first candidate', () => {
    const forms = baseFormsOf('Studies')

    expect(forms.has('studies')).toBe(true)
    expect(forms.has('study')).toBe(true)
  })
})
