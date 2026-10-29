/**
 * 自选单词（focusWords）的纯函数
 *
 * 用途：篇幅 → 可选上限、选择列表的归一化与截断、请求体拼装规则。
 * 用法：focusWordLimit(300) → 30；normalizeFocusWords(['Apple', 'apple ']) → ['Apple']；
 *       focusWordsPayload(['apple']) → { focusWords: ['apple'] }；
 *       focusWordsPayload([]) → {}（不选就完全不发，后端收到 [] 会 400）。
 *
 * 口径与后端 vocabulary-pool.js 一致：上限 = round(targetWords × 0.1)，
 * 后端在调用模型之前校验，超限直接 400，所以前端选满就禁用其余选项，
 * 不靠「提交时再报错」兜底。
 */

/** 与后端 TARGET_WORD_RATIO 同值；改一边必须改另一边 */
export const FOCUS_WORD_RATIO = 0.1

/**
 * 本次篇幅允许选几个词
 * @param {number} targetWords — 文章篇幅（100–1000，后端按 10 的倍数校验）
 * @returns {number} 0 表示参数还没就绪，界面按「暂不可选」处理
 */
export function focusWordLimit(targetWords) {
  const value = Number(targetWords)
  if (!Number.isFinite(value) || value <= 0) return 0

  return Math.max(1, Math.round(value * FOCUS_WORD_RATIO))
}

/**
 * 归一化用户选择：去空白、按大小写去重、按上限截断
 *
 * 后端也会做同样的归一化（大小写、首尾空格、弯撇号），这里做是为了让界面上的
 * 「已选 N / M」与真正发出去的数组一致——否则显示 10 个、实际发 9 个。
 * @param {unknown} words — 任意数组（本地存储、接口回填都可能是脏数据）
 * @param {{ limit?: number }} options — limit 省略表示不截断
 * @returns {string[]} 保留首次出现的顺序与原始大小写
 */
export function normalizeFocusWords(words, { limit = Infinity } = {}) {
  const seen = new Set()
  const result = []
  const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : Infinity
  if (max === 0) return []

  for (const raw of Array.isArray(words) ? words : []) {
    const word = String(raw ?? '').trim()
    if (!word) continue

    const key = word.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    result.push(word)
    if (result.length >= max) break
  }

  return result
}

/**
 * 拼进生成请求体
 *
 * 没选词时返回空对象而不是 `{ focusWords: [] }`：后端把空数组当参数错误（400），
 * 静默退回「自动选词」会让用户以为自己的选择生效了（md/54 §3.2）。
 * @param {string[]} words — 已经归一化过的选择
 * @returns {{ focusWords?: string[] }}
 */
export function focusWordsPayload(words) {
  const list = normalizeFocusWords(words)
  return list.length ? { focusWords: list } : {}
}

/** 选满了：界面上其余选项要禁用（不再接受新增，已选仍可移除） */
export function isFocusWordsFull(words, limit) {
  return normalizeFocusWords(words).length >= Math.max(0, limit)
}
