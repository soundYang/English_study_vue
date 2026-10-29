/**
 * 用户反馈 API 门面
 * 提交一条反馈；不要求登录，设备号由 request.js 统一注入（后端 md/37 §5.1）。
 */
import { config } from '../config'
import { mockFeedback } from '../mock/adapter'
import { apiPost } from '../unit/request'

/**
 * 提交反馈
 * content 去首尾空白后 10–2000 字；category 六选一；contact / page 各 ≤100 字。
 * 成功返回 201 `{ id, status: 'open', createdAt }`。
 */
export function submitFeedback(payload, options = {}) {
  if (config.useMock) return mockFeedback.submit(payload)
  return apiPost('/feedback', payload, options)
}
