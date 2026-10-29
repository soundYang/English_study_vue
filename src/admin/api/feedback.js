/**
 * 管理端反馈 API
 * 列表只给前 80 字摘要，全文、设备与 IP 只在详情（md/40 §10 第 6 条）。
 */
import { adminGet, adminPatch } from './http'

/**
 * 反馈列表
 * @param {{ status?: 'open'|'replied'|'closed'|'', category?: string, page?: number, size?: number }} query
 */
export function fetchAdminFeedback({ status = '', category = '', page = 1, size = 20 } = {}) {
  const params = { page, size }
  // 空串代表不过滤，不能发给后端的 enum 校验
  if (status) params.status = status
  if (category) params.category = category
  return adminGet('/admin/feedback', params)
}

/** 反馈详情（全文 + 设备 / IP / UA） */
export function fetchAdminFeedbackDetail(id) {
  return adminGet(`/admin/feedback/${encodeURIComponent(id)}`)
}

/**
 * 回复 / 关闭反馈
 * @param {string} id
 * @param {{ status?: 'replied'|'closed', reply?: string }} payload
 */
export function updateAdminFeedback(id, payload) {
  return adminPatch(`/admin/feedback/${encodeURIComponent(id)}`, payload)
}
