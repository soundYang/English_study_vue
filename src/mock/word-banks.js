/**
 * Mock 可选词库目录
 *
 * 用途：在真实后端词库接口之外，为「词库总览 / 词库详情 / 导入 / 重置」提供一份
 *       可控、可重复的目录数据，保证 mock 模式下整条链路都能走通。
 * 用法：只由 src/mock/adapter.js 读取，视图与 store 不直接依赖本文件。
 *
 * 与后端 word-banks.catalog.js 同口径：
 *   · 只收词频在 1–3000（高频）与 3001–8000（中频）之间的词；
 *   · 基础词表已覆盖的词不进可选词库；
 *   · 同一份目录里不重复。
 * 词频数字沿用种子词表的 COCA 名次；为让两个词库都有足够样本，
 * 少数词的近似名次按「中频」区间补足，不代表真实 COCA 精确值。
 */

/** 词库分档，与后端 WORD_BANK_BANDS 一致 */
export const MOCK_WORD_BANK_BANDS = Object.freeze({
  high: { min: 1, max: 3000, label: '高频词库' },
  mid: { min: 3001, max: 8000, label: '中频词库' },
})

/**
 * 基础词表已覆盖的词：与后端一样从可选词库目录中剔除。
 * mock 没有 650 词全表，这里只列一个足以覆盖跳过分支的小集合。
 */
export const MOCK_BASIC_WORDS = new Set([
  'about',
  'across',
  'again',
  'air',
  'allow',
  'alone',
  'animal',
  'answer',
  'appear',
  'become',
  'before',
  'believe',
  'between',
  'build',
  'carry',
  'change',
  'clear',
])

/**
 * 词头 → COCA 近似名次
 * 只列 mock 词典里存在的词；未列出的词不会进入目录。
 */
const RANK_BY_WORD = {
  abandon: 2910,
  accept: 1130,
  achieve: 1245,
  agree: 520,
  angry: 1717,
  apple: 2718,
  arrive: 1150,
  avoid: 1290,
  balance: 4120,
  beautiful: 760,
  book: 242,
  brave: 3760,
  break: 400,
  bright: 1490,
  busy: 1660,
  calm: 3890,
  careful: 1520,
  climb: 3410,
  curious: 3139,
  garden: 1047,
  gentle: 3421,
  happy: 748,
  journey: 2431,
  language: 723,
  memory: 894,
  morning: 358,
  park: 1233,
  patient: 573,
  practice: 565,
  quiet: 1442,
  read: 338,
  simple: 764,
  story: 234,
  study: 241,
  sunny: 4921,
  tired: 1973,
  wonder: 791,
}

let cached = null

/** 懒构建目录；词典词条来自 mock/dictionary.js，保证详情与目录一致 */
function buildCatalog(findEntry) {
  const high = []
  const mid = []

  for (const [word, rank] of Object.entries(RANK_BY_WORD)) {
    if (MOCK_BASIC_WORDS.has(word)) continue

    const entry = findEntry(word)
    if (!entry) continue

    if (rank <= MOCK_WORD_BANK_BANDS.high.max) {
      high.push({ word, rank, entry })
    } else if (rank >= MOCK_WORD_BANK_BANDS.mid.min && rank <= MOCK_WORD_BANK_BANDS.mid.max) {
      mid.push({ word, rank, entry })
    }
  }

  // 与后端一致：目录按词频升序，先看到最常用的词
  high.sort((a, b) => a.rank - b.rank)
  mid.sort((a, b) => a.rank - b.rank)

  return { high, mid }
}

/**
 * 取词库目录
 * @param {(word: string) => object | null} findEntry 词典精确查词函数
 */
export function getMockWordBankCatalog(findEntry) {
  if (!cached) cached = buildCatalog(findEntry)
  return cached
}

/** 词形校验：与后端 checkWord 的基本口径一致（只允许字母、连字符、撇号） */
export function isMockBankWord(word) {
  const value = String(word ?? '').trim()
  return value.length > 0 && value.length <= 45 && /^[a-z'-]+$/.test(value)
}
