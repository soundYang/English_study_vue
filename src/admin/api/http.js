/**
 * 管理端 HTTP 客户端
 *
 * 用途：后台专用的 axios 实例。独立注入 `wr.admin.token`，不读用户令牌、
 *       不带 `X-Device-Id`，401 只清后台会话并广播 `wr:admin-expired`。
 * 用法：`adminGet('/admin/overview')`；错误统一为 AdminApiError，页面只认 `code`。
 *
 * 为什么不复用 `src/unit/request.js`：那个客户端会给所有请求注入用户令牌与设备头，
 * 并在 401 AUTH_REQUIRED 时广播用户掉线；两套会话必须两套客户端（md/40 §0）。
 */
import axios from 'axios'
import { config } from '../../config'
import { adminAuth } from '../auth'

export const ADMIN_EXPIRED_EVENT = 'wr:admin-expired'

const NETWORK_MESSAGE = '网络出了点问题，请稍后重试。'
const EXPIRED_MESSAGE = '登录已过期，请重新登录'
const NOT_CONFIGURED_MESSAGE =
  '后台未配置：请在服务端设置 ADMIN_USERNAME / ADMIN_PASSWORD_HASH 后重启'

/**
 * 后台错误：`{ code, message, field, details, status }`
 * 与用户侧 BusinessError 同形但独立命名，避免误用面向学习者的错误文案表。
 */
export class AdminApiError extends Error {
  constructor(message, code = 'ADMIN_ERROR', options = {}) {
    super(message)
    this.name = 'AdminApiError'
    this.code = code
    this.field = options.field || ''
    this.details = options.details || {}
    this.status = options.status || 0
  }
}

/**
 * 把 axios 错误归一化成页面可判断的形态（md/40 §6）。
 *
 * 顺序很重要：响应体里带 code 的一律按业务错误处理，
 * 这样 `FEEDBACK_NOT_FOUND` / `ADMIN_USER_NOT_FOUND` 这类 404 不会被误判成
 * 「后台未配置」；只有 Express 默认的裸 404（无 JSON error）才是配置缺失。
 */
export function normalizeAdminError(error) {
  if (error instanceof AdminApiError) return error

  const response = error?.response
  if (!response) return new AdminApiError(NETWORK_MESSAGE, 'NETWORK_ERROR', { status: 0 })

  const status = Number(response.status) || 0
  const payload = response.data?.error

  if (payload?.code) {
    return new AdminApiError(payload.message || '请求失败', payload.code, {
      field: payload.field || '',
      details: payload.details || {},
      status,
    })
  }

  if (status === 404) {
    return new AdminApiError(NOT_CONFIGURED_MESSAGE, 'ADMIN_NOT_CONFIGURED', { status })
  }
  if (status === 401) {
    return new AdminApiError(EXPIRED_MESSAGE, 'ADMIN_AUTH_REQUIRED', { status })
  }
  if (status === 429) {
    return new AdminApiError('操作太频繁，请稍后再试', 'RATE_LIMITED', { status })
  }
  if (status >= 500) {
    return new AdminApiError('服务器开小差了', 'SERVER_ERROR', { status })
  }

  return new AdminApiError(payload?.message || '请求失败', 'INVALID_REQUEST', { status })
}

const http = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: config.requestTimeout,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((requestConfig) => {
  if (adminAuth.token) requestConfig.headers.Authorization = `Bearer ${adminAuth.token}`

  // GET 防缓存；后台看的是实时数据，代理缓存旧结果比慢更糟
  if (requestConfig.method === 'get') {
    requestConfig.params = { ...(requestConfig.params || {}), _t: Date.now() }
  }

  return requestConfig
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const code = error?.response?.data?.error?.code

    // 令牌过期：清会话并广播，由 AdminLayout 负责导航；这里不依赖 router
    if (status === 401 && code === 'ADMIN_AUTH_REQUIRED') {
      adminAuth.clear(EXPIRED_MESSAGE)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(ADMIN_EXPIRED_EVENT))
      }
    }

    return Promise.reject(normalizeAdminError(error))
  },
)

export async function adminGet(url, params = {}, options = {}) {
  const { data } = await http.get(url, { params, ...options })
  return data
}

export async function adminPost(url, body, options = {}) {
  const { data } = await http.post(url, body, options)
  return data
}

export async function adminPatch(url, body, options = {}) {
  const { data } = await http.patch(url, body, options)
  return data
}

export default http
