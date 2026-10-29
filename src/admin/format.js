/**
 * 管理端格式化
 *
 * 用途：时间（北京时间）、数字、token、百分比、额度与反馈文案。
 *       全部为纯函数，不读全局状态，便于单测（md/40 §5.1）。
 */

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const NUMBER_FORMATTER = new Intl.NumberFormat('zh-CN')

export const EMPTY_TEXT = '—'

export const FEEDBACK_CATEGORY_LABELS = Object.freeze({
  bug: '功能异常',
  feature: '功能建议',
  content: '内容问题',
  data: '数据问题',
  privacy: '隐私相关',
  other: '其它',
})

export const FEEDBACK_STATUS_LABELS = Object.freeze({
  open: '待处理',
  replied: '已回复',
  closed: '已关闭',
})

export const READING_STATUS_LABELS = Object.freeze({
  generated: '待作答',
  submitted: '已提交',
})

/** 分类下拉：空串代表不过滤，其余与 FeedbackModal 的六项保持一致 */
export const FEEDBACK_CATEGORY_OPTIONS = Object.freeze([
  { value: '', label: '全部分类' },
  ...Object.entries(FEEDBACK_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
])

/** 按北京时区拆出年月日时分；空值与非法时间返回 null，调用方回退到「—」 */
function datePartsOf(value) {
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const parts = DATE_TIME_FORMATTER.formatToParts(date)
  const pick = (type) => parts.find((part) => part.type === type)?.value || ''

  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
  }
}

/** `2026-10-29T01:12:00.000Z` → `2026-10-29 09:12` */
export function formatDateTime(value) {
  const parts = datePartsOf(value)
  if (!parts) return EMPTY_TEXT
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

/** 列表两行时间的上行：`2026-10-29` */
export function formatDate(value) {
  const parts = datePartsOf(value)
  if (!parts) return EMPTY_TEXT
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** 列表两行时间的下行：`09:12` */
export function formatTime(value) {
  const parts = datePartsOf(value)
  if (!parts) return EMPTY_TEXT
  return `${parts.hour}:${parts.minute}`
}

/** 千分位；空值、非法值按 0 处理，表格里不出现 NaN */
export function formatCount(value) {
  const number = Number(value)
  return Number.isFinite(number) ? NUMBER_FORMATTER.format(number) : '0'
}

/** 去掉小数末尾的 `.0`：`1.0万` → `1万` */
function trimZero(value) {
  return String(Number(value.toFixed(1)))
}

/**
 * token 紧凑格式：< 1 万原样千分位；≥ 1 万用「万」；≥ 1 亿用「亿」
 * 精确值由调用方放在 `title` 里，数字本身要能一眼比较大小。
 */
export function formatTokens(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return '0'

  if (number >= 100_000_000) return `${trimZero(number / 100_000_000)}亿`
  if (number >= 10_000) return `${trimZero(number / 10_000)}万`
  return NUMBER_FORMATTER.format(number)
}

/** 百分比；分母为 0 或非法时返回「—」，不编造 0% */
export function formatPercent(part, total, digits = 1) {
  const numerator = Number(part)
  const denominator = Number(total)
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return EMPTY_TEXT
  }

  return `${Number(((numerator / denominator) * 100).toFixed(digits))}%`
}

/** 今日额度：关闭时「未启用」，开启时 `used/limit`；used 为 null 不显示 0 */
export function formatQuota(quota) {
  if (!quota?.enabled) return '未启用'

  const used =
    quota.used === null || quota.used === undefined ? EMPTY_TEXT : formatCount(quota.used)
  const limit =
    quota.limit === null || quota.limit === undefined ? EMPTY_TEXT : formatCount(quota.limit)

  return `${used}/${limit}`
}

/**
 * 手机号遮中间四位：`13812348000` → `138****8000`
 * 反馈里的 phone 是提交时的明文快照，展示前必须自己遮（md/40 §10 第 6 条）。
 */
export function maskPhone(phone) {
  const value = String(phone ?? '').trim()
  if (!value) return ''
  if (value.length <= 7) return value
  return `${value.slice(0, 3)}****${value.slice(-4)}`
}

/** 反馈提交人：username → userId → 未登录用户 */
export function submitterLabel({ username = '', userId = '' } = {}) {
  if (username) return username
  if (userId && userId !== 'anonymous') return userId
  return '未登录用户'
}

/** 反馈联系方式：优先用户填写，其次遮挡后的提交时手机号 */
export function contactLabel({ contact = '', phone = '' } = {}) {
  if (contact) return contact
  return maskPhone(phone) || EMPTY_TEXT
}

export function feedbackCategoryLabel(value) {
  return FEEDBACK_CATEGORY_LABELS[value] || value || EMPTY_TEXT
}

export function feedbackStatusLabel(value) {
  return FEEDBACK_STATUS_LABELS[value] || value || EMPTY_TEXT
}

export function readingStatusLabel(value) {
  return READING_STATUS_LABELS[value] || value || EMPTY_TEXT
}
