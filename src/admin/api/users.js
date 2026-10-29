/**
 * 管理端用户台账 API
 * 列表只给脱敏手机号与个人词库；三档已知词、全量手机号、最近文章只在详情接口。
 */
import { pathSegment } from '../../unit/path'
import { adminGet } from './http'

/**
 * 用户列表
 *
 * `hasApiKey` 只接受字符串 `'true'` / `'false'`；不传表示不过滤。
 * 后端对其它值返回 400，所以这里先过滤掉空值与非法值，避免拼出 `hasApiKey=yes`。
 *
 * @param {{ q?: string, page?: number, size?: number, sort?: 'createdAt'|'lastLoginAt'|'tokens'|'readings', hasApiKey?: 'true'|'false'|'' }} query
 */
export function fetchAdminUsers({
  q = '',
  page = 1,
  size = 20,
  sort = 'createdAt',
  hasApiKey = '',
} = {}) {
  const params = { q, page, size, sort }
  if (hasApiKey === 'true' || hasApiKey === 'false') params.hasApiKey = hasApiKey
  return adminGet('/admin/users', params)
}

/** 用户详情；dataKey 可能含 URL 特殊字符，必须编码 */
export function fetchAdminUser(dataKey) {
  return adminGet(`/admin/users/${pathSegment(dataKey)}`)
}
