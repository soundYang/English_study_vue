/**
 * 题型标签
 * 后端 ai.schema.js 的 QUESTION_TYPES 只有四种：
 *   detail / paraphrase / inference / main_idea
 * 老文档的题没有 type（reading.model.js 里 default: null），
 * 这时不显示标签，也不兜底成「细节题」——猜错比不显示更糟。
 */

export const QUESTION_TYPE_LABELS = Object.freeze({
  detail: '细节题',
  paraphrase: '释义题',
  inference: '推断题',
  main_idea: '主旨题',
})

/**
 * 题型 → 中文标签；未知、缺失或非字符串时返回空串。
 * 用 Object.hasOwn 而不是直接查表，避免 `type = 'constructor'` 命中原型属性。
 */
export function questionTypeLabel(type) {
  if (typeof type !== 'string') return ''
  return Object.hasOwn(QUESTION_TYPE_LABELS, type) ? QUESTION_TYPE_LABELS[type] : ''
}
