/**
 * 管理端用户台账 API
 * 列表只给脱敏手机号与个人词库；三档已知词、全量手机号、最近文章只在详情接口。
 */
import { adminGet } from './http'

/**
 * 用户列表
 * @param {{ q?: string, page?: number, size?: number, sort?: 'createdAt'|'lastLoginAt'|'tokens'|'readings' }} query
 */
export function fetchAdminUsers({ q = '', page = 1, size = 20, sort = 'createdAt' } = {}) {
  return adminGet('/admin/users', { q, page, size, sort })
}

/** 用户详情；dataKey 可能含 URL 特殊字符，必须编码 */
export function fetchAdminUser(dataKey) {
  return adminGet(`/admin/users/${encodeURIComponent(dataKey)}`)
}
