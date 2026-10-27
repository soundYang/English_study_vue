/**
 * 格式化工具
 * 纯函数集合：日期、时间、百分比、词数与倒计时格式化，不读写全局状态。
 */

function pad2(value) {
  return String(value).padStart(2, '0')
}

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** 2026-10-27 */
export function formatDate(value) {
  const date = toDate(value)
  if (!date) return ''
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** 2026-10-27 14:05 */
export function formatDateTime(value) {
  const date = toDate(value)
  if (!date) return ''
  return `${formatDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** 0～100 的数值转为 “88%”；空值返回 “—” */
export function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${Math.round(Number(value))}%`
}

/** 100 → “100 词” */
export function formatWordCount(value) {
  return `${Math.max(0, Math.round(Number(value) || 0))} 词`
}

/** 按空白切分统计英文词数，用于历史统计中的累计阅读词数 */
export function countWords(text) {
  const content = String(text ?? '').trim()
  if (!content) return 0
  return content.split(/\s+/).filter(Boolean).length
}

/** 倒计时秒数 → “14:59” */
export function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  return `${pad2(Math.floor(safe / 60))}:${pad2(safe % 60)}`
}
