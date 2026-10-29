/**
 * 管理端日志页的选项与纯函数
 *
 * 用途：四个 tab、时间范围、每页数量与各列表筛选下拉的取值，以及
 *       「时间范围 → ISO 起点」「状态码 → 颜色」这类不依赖组件的规则。
 * 用法：`resolveLogRange(route.query.range)` → `{ value, days, from }`；
 *       `logStatusTone(503)` → `'is-danger'`。
 *
 * 时间按北京时间切：`today` 是北京时间当天 00:00 起，
 * 与后端 resetAt / 日志展示口径一致，不跟浏览器时区走（md/53 §10）。
 */

const DAY_MS = 24 * 60 * 60 * 1000
// 中国没有夏令时，固定偏移即可；不用 Intl 是为了让 from 是纯粹的时间戳运算
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

/** 四个 tab；value 同时是 URL 的 `tab` */
export const LOG_TAB_OPTIONS = Object.freeze([
  { value: 'overview', label: '概览' },
  { value: 'access', label: '访问' },
  { value: 'errors', label: '报错' },
  { value: 'logins', label: '登录' },
])

/**
 * 快捷时间范围；`days` 给 `/summary`，`from` 给三个列表接口。
 * 列表只给起点、不给终点：日志只增不减，终点取「现在」没有额外意义。
 */
export const LOG_RANGE_OPTIONS = Object.freeze([
  { value: 'today', label: '今天', days: 1 },
  { value: '7d', label: '近 7 天', days: 7 },
  { value: '30d', label: '近 30 天', days: 30 },
])

export const LOG_RANGE_DEFAULT = '7d'

export const LOG_PAGE_SIZES = Object.freeze([
  { value: 20, label: '20 条/页' },
  { value: 50, label: '50 条/页' },
  { value: 100, label: '100 条/页' },
])

/**
 * 访问日志的状态码筛选。
 * 后端 `status` 是**精确匹配**（md/53 §10.3），不能传 `4xx` 这种区间，
 * 所以只列常见档位；要「只看 4xx」先看概览卡里的分档数字。
 */
export const ACCESS_STATUS_OPTIONS = Object.freeze([
  { value: '', label: '全部状态码' },
  ...[200, 201, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503].map((code) => ({
    value: String(code),
    label: String(code),
  })),
])

export const LOGIN_ROLE_OPTIONS = Object.freeze([
  { value: '', label: '全部角色' },
  { value: 'user', label: '普通用户' },
  { value: 'admin', label: '管理员' },
])

// 后端只收字符串 'true' / 'false'；空串代表不过滤
export const LOGIN_SUCCESS_OPTIONS = Object.freeze([
  { value: '', label: '全部' },
  { value: 'true', label: '成功' },
  { value: 'false', label: '失败' },
])

function beijingDayStart(nowMs) {
  const shifted = nowMs + BEIJING_OFFSET_MS
  return Math.floor(shifted / DAY_MS) * DAY_MS - BEIJING_OFFSET_MS
}

/**
 * 把 URL 里的范围值解析成接口参数；非法值回落到默认（近 7 天）。
 *
 * @param {string} value — `today` / `7d` / `30d`
 * @param {Date} now — 允许注入，便于单测；页面调用时省略
 * @returns {{ value: string, days: number, from: string }} from 为 ISO 字符串
 */
export function resolveLogRange(value, now = new Date()) {
  const option = LOG_RANGE_OPTIONS.find((item) => item.value === value) || LOG_RANGE_OPTIONS[1]
  const nowMs = now.getTime()
  const fromMs = option.value === 'today' ? beijingDayStart(nowMs) : nowMs - option.days * DAY_MS

  return { value: option.value, days: option.days, from: new Date(fromMs).toISOString() }
}

/** 状态码颜色：2xx 绿、4xx 黄、5xx 红；非数字按灰处理，不编造颜色 */
export function logStatusTone(status) {
  const code = Number(status)
  if (!Number.isFinite(code)) return 'is-muted'
  if (code >= 500) return 'is-danger'
  if (code >= 400) return 'is-warning'
  return 'is-success'
}
