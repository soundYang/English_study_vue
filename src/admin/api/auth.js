/**
 * 管理端鉴权 API
 * 登录、登出与身份查询；响应形状以 English_node/src/modules/admin/admin.routes.js 为准。
 */
import { adminGet, adminPost } from './http'

/**
 * 管理员登录
 * @param {{ username: string, password: string }} payload
 * @returns {Promise<{ token: string, expiresAt: string }>} 注意：响应里没有 username
 */
export function adminLogin(payload) {
  return adminPost('/admin/auth/login', payload)
}

/** 登出（幂等；令牌已失效也返回 200） */
export function adminLogout() {
  return adminPost('/admin/auth/logout')
}

/** 当前管理员 `{ username, expiresAt }`，登录后用来补显示名 */
export function fetchAdminMe() {
  return adminGet('/admin/auth/me')
}
