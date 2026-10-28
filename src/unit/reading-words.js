/**
 * 正文里未学单词的匹配
 *
 * 用途：把段落切成「普通文本 / 命中的未学词」片段，供 ArticleCard 就地标注。
 *       纯函数、无副作用；匹配不查词形库，只做规则还原（见 md/18 §9）。
 * 用法：const lookup = buildLookup(reading.newWords)
 *       annotateParagraph('Nothing dramatic happened.', lookup)
 *       // [{ text: 'Nothing ' }, { text: 'dramatic', entry }, { text: ' happened.' }]
 *
 * 能还原的变形：复数 / 三单（-s、-es、-ies）、过去式（-ed、-ied）、进行时（-ing）、
 *              比较级 / 最高级（-er、-est）、副词（-ly），含去双写辅音与补 e。
 * 还原不了的：不规则变化（go→went、mouse→mice）、多词短语、派生词（nation→national）。
 */

// 连字符当分隔符（uncertain-looking 拆成两个词），撇号留在词内（don't 是一个词）
const WORD_PATTERN = /[A-Za-z]+(?:['’][A-Za-z]+)*/g
const VOWELS = 'aeiou'

/** stopped → stop、running → run：去掉结尾重复的辅音；不是双写就返回空串 */
function undouble(stem) {
  if (stem.length < 4) return ''
  const last = stem.at(-1)
  if (last !== stem.at(-2) || VOWELS.includes(last)) return ''
  return stem.slice(0, -1)
}

/**
 * 一个词形可能对应的原形候选，原文本身排在第一位
 * 只用来「查表」，多余的候选不会造成误标——表里没有就是没命中
 */
export function baseFormsOf(token) {
  const lower = String(token || '').toLowerCase()
  const forms = new Set([lower])

  if (lower.endsWith('ies') && lower.length > 4) forms.add(`${lower.slice(0, -3)}y`)
  if (lower.endsWith('es') && lower.length > 3) forms.add(lower.slice(0, -2))
  if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 2)
    forms.add(lower.slice(0, -1))

  if (lower.endsWith('ied') && lower.length > 4) forms.add(`${lower.slice(0, -3)}y`)
  if (lower.endsWith('ed') && lower.length > 3) {
    const stem = lower.slice(0, -2)
    forms.add(stem)
    forms.add(`${stem}e`)
    const single = undouble(stem)
    if (single) forms.add(single)
  }

  if (lower.endsWith('ing') && lower.length > 4) {
    const stem = lower.slice(0, -3)
    forms.add(stem)
    forms.add(`${stem}e`)
    const single = undouble(stem)
    if (single) forms.add(single)
  }

  if (lower.endsWith('est') && lower.length > 4) {
    const stem = lower.slice(0, -3)
    forms.add(stem)
    forms.add(`${stem}e`)
    const single = undouble(stem)
    if (single) forms.add(single)
  } else if (lower.endsWith('er') && lower.length > 3) {
    const stem = lower.slice(0, -2)
    forms.add(stem)
    forms.add(`${stem}e`)
    const single = undouble(stem)
    if (single) forms.add(single)
  }

  if (lower.endsWith('ly') && lower.length > 3) forms.add(lower.slice(0, -2))

  return forms
}

/** 未学词数组 → 小写原形到条目的索引；同词重复时保留第一条 */
export function buildLookup(entries) {
  const lookup = new Map()
  for (const entry of entries || []) {
    const word = String(entry?.word || '')
      .trim()
      .toLowerCase()
    if (word && !lookup.has(word)) lookup.set(word, entry)
  }
  return lookup
}

function findEntry(token, lookup) {
  for (const form of baseFormsOf(token)) {
    if (lookup.has(form)) return lookup.get(form)
  }
  return null
}

/**
 * 段落切分：文本片段按原样返回，命中的词带上 `entry`
 * 所有片段的 text 拼起来与入参完全相同，渲染不会丢空格或标点
 */
export function annotateParagraph(paragraph, lookup) {
  const text = String(paragraph || '')
  const tokens = []
  let cursor = 0

  for (const match of text.matchAll(WORD_PATTERN)) {
    const index = match.index ?? 0
    if (index > cursor) tokens.push({ text: text.slice(cursor, index) })

    const raw = match[0]
    const entry = findEntry(raw, lookup)
    tokens.push(entry ? { text: raw, entry } : { text: raw })
    cursor = index + raw.length
  }

  if (cursor < text.length) tokens.push({ text: text.slice(cursor) })
  return tokens
}
