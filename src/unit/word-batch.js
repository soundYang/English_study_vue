/**
 * 批量修改学习状态的展示辅助
 *
 * 只放纯函数：目标下拉按当前标签收敛、跳过原因中文映射、结果文案拼装。
 * 接口语义在 api/words.js 与 mock adapter 里，视图不做业务判断。
 */

/** 普通标签页可改到的目标；「已排除」页只能恢复 */
const DEFAULT_TARGETS = Object.freeze([
  { value: 'learning', label: '复习中' },
  { value: 'mastered', label: '已掌握' },
  { value: 'removed', label: '已排除' },
])

const REMOVED_TARGETS = Object.freeze([{ value: 'restore', label: '恢复' }])

const TARGET_LABELS = Object.freeze({
  new: '新词',
  learning: '复习中',
  mastered: '已掌握',
  removed: '已排除',
  restore: '恢复',
})

/**
 * 跳过原因的中文说明（md/61 §4.3）
 * 未知 reason 回落「已跳过」，避免后端新增原因时前端露出英文常量。
 */
export const SKIP_REASON_LABELS = Object.freeze({
  NOT_FOUND: '词不存在',
  BASIC_REMOVED: '需要先恢复',
  NEW_STATE_ONLY_TODAY: '只能设为今天新增的词',
  FUNCTION_WORD_IMMUTABLE: '功能词不可移除',
  BASIC_WORD_READONLY: '只读词不可移除',
})

/** 当前标签页允许的目标；UI 不提供 target='new'（只对今天新增的词生效） */
export function batchTargetOptionsOf(study) {
  return study === 'removed' ? REMOVED_TARGETS : DEFAULT_TARGETS
}

/** 目标状态中文名；未知值原样返回，便于日志排查 */
export function batchTargetLabel(target) {
  return TARGET_LABELS[target] || target
}

/**
 * 批量结果文案
 *
 * 一段话讲清三类结果：已更新 / 未变化 / 跳过。跳过按原因聚合，
 * 避免一次 200 条时 Toast 被词表撑爆；未知原因统一说「已跳过」。
 */
export function batchResultMessage(result = {}) {
  const updated = Number(result?.updated) || 0
  const unchanged = Number(result?.unchanged) || 0
  const skipped = Array.isArray(result?.skipped) ? result.skipped : []
  const parts = []

  if (updated > 0) parts.push(`已更新 ${updated} 个词`)
  if (unchanged > 0) parts.push(`${unchanged} 个未变化`)

  if (skipped.length > 0) {
    const counts = new Map()
    skipped.forEach((item) => {
      const label = SKIP_REASON_LABELS[item?.reason] || '已跳过'
      counts.set(label, (counts.get(label) || 0) + 1)
    })
    const detail = [...counts].map(([label, count]) => `${label} ${count} 个`).join('、')
    parts.push(`跳过 ${skipped.length} 个（${detail}）`)
  }

  if (parts.length === 0) return '没有需要修改的词'
  return parts.join('，')
}

/** 有实际写入用 success，只改动了 0 条时用 info，避免把「全部跳过」显示成成功 */
export function batchResultType(result = {}) {
  return (Number(result?.updated) || 0) > 0 ? 'success' : 'info'
}
