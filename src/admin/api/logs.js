/**
 * 管理端日志 API
 *
 * 用途：四个只读查询——访问日志 / 报错日志 / 登录记录 / 最近 N 天汇总（md/53 §10）。
 *       全部走后台令牌；不在用户侧复用，日志里有 IP 与访问路径（md/53 §6）。
 *
 * 参数约定：后端对空串的日期字段会当「没传」处理，但 `status` / `role` / `success`
 * 是枚举，空串会被 400 拒绝，所以这里统一丢掉空值，页面只传「有值」的过滤条件。
 */
import { adminGet } from './http'

/** 丢掉 undefined / null / 空串，避免 `status=` 这种看起来有值的参数 */
function compact(params) {
  const result = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    result[key] = value
  }
  return result
}

/**
 * 访问日志列表
 *
 * `ip` / `userId` 精确，`path` 包含匹配；`status` 是具体状态码（不是区间）。
 *
 * @param {{ page?: number, size?: number, ip?: string, userId?: string, status?: string, path?: string, from?: string }} query
 */
export function fetchAccessLogs({
  page = 1,
  size = 20,
  ip = '',
  userId = '',
  status = '',
  path = '',
  from = '',
} = {}) {
  return adminGet('/admin/logs/access', compact({ page, size, ip, userId, status, path, from }))
}

/**
 * 报错日志列表（只有 5xx）
 *
 * @param {{ page?: number, size?: number, ip?: string, code?: string, path?: string, from?: string }} query
 */
export function fetchErrorLogs({
  page = 1,
  size = 20,
  ip = '',
  code = '',
  path = '',
  from = '',
} = {}) {
  return adminGet('/admin/logs/errors', compact({ page, size, ip, code, path, from }))
}

/**
 * 登录记录列表（成功与失败都在里面）
 *
 * `success` 只接受字符串 `'true'` / `'false'`；`role` 只接受 `user` / `admin`。
 *
 * @param {{ page?: number, size?: number, ip?: string, userId?: string, username?: string, role?: string, success?: string, from?: string }} query
 */
export function fetchLoginLogs({
  page = 1,
  size = 20,
  ip = '',
  userId = '',
  username = '',
  role = '',
  success = '',
  from = '',
} = {}) {
  return adminGet(
    '/admin/logs/logins',
    compact({ page, size, ip, userId, username, role, success, from }),
  )
}

/**
 * 最近 N 天的汇总（1–90，默认 7）
 *
 * @param {{ days?: number }} query
 */
export function fetchLogSummary({ days = 7 } = {}) {
  return adminGet('/admin/logs/summary', { days })
}
