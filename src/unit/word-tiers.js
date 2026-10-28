/**
 * 词频分档
 * 后端只给 COCA 原始名次（cocaRank，越小越常用），「高频 / 中频 / 低频」属于展示口径，
 * 阈值放在前端，不随接口变化。
 */

/** 名次上限从低到高；Infinity 收下所有更大的名次 */
export const COCA_TIERS = [
  { key: 'high', max: 3000, label: '高频' },
  { key: 'mid', max: 8000, label: '中频' },
  { key: 'low', max: Infinity, label: '低频' },
]

/**
 * 名次 → 档位
 * 手填词的 cocaRank 是 null（不是 0），0 也不能当成「第 0 名」，
 * 因此非正整数一律返回 null，由模板整块不渲染。
 */
export function frequencyTierOf(rank) {
  if (!Number.isInteger(rank) || rank <= 0) return null
  return COCA_TIERS.find((tier) => rank <= tier.max) || null
}
