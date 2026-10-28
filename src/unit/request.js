/**
 * HTTP 请求客户端
 * Axios 实例与拦截器：注入 token、GET 防缓存、统一错误归一化。
 * 只负责请求，不做 UI 提示；由 store / 视图决定如何展示错误。
 * 当前 VITE_USE_MOCK=true 时该模块不参与请求，但保持可用以便一键切换后端。
 */
import axios from 'axios'
import { config } from '../config'
import { normalizeApiError } from '../errors'
import { localStore, storageKeys } from './storage'

// 运行中收到 401 AUTH_REQUIRED 时广播，由 App.vue 负责清会话并导航到登录页；
// 这里不直接操作路由，避免请求层依赖 router（md/34 §4 第 3 条）
export const AUTH_EXPIRED_EVENT = 'wr:auth-expired'

const http = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: config.requestTimeout,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((requestConfig) => {
  const token = localStore.get(storageKeys.accessToken, '')
  if (token) requestConfig.headers.Authorization = `Bearer ${token}`

  // GET 附加时间戳，避免浏览器或代理缓存旧数据
  if (requestConfig.method === 'get') {
    requestConfig.params = { ...(requestConfig.params || {}), _t: Date.now() }
  }
  return requestConfig
})

/**
 * 429 的剩余秒数
 * express-rate-limit 用 draft-7，响应头形如 `RateLimit: limit=20, remaining=0, reset=42`；
 * 旧版 X-RateLimit-* 后端已不发。拿不到就返回 0，调用方据此不展示倒计时。
 */
function retryAfterOf(error) {
  const headers = error?.response?.headers || {}
  const rateLimit = headers.ratelimit || headers.RateLimit || headers['x-ratelimit-reset'] || ''
  const match = String(rateLimit).match(/reset=(\d+)/)
  if (match) return Number(match[1])

  const retryAfter = Number(headers['retry-after'])
  return Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 0
}

// 401 只清理 token 并抛出 AuthError，不在此处跳转：MVP 没有登录页，导航由调用方决定
http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const code = error?.response?.data?.error?.code
    if (status === 401) localStore.remove(storageKeys.accessToken)

    // 只有「没登录 / 令牌失效」才广播；登录失败的 401 也有 code，但不是 AUTH_REQUIRED
    if (status === 401 && code === 'AUTH_REQUIRED' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
    }

    const normalized = normalizeApiError(error)
    // 429 冷却要等多少秒只有响应头知道；挂到错误对象上，三个生成入口共用（md/22 §8.5 ③）
    const retryAfter = retryAfterOf(error)
    if (retryAfter > 0) normalized.retryAfter = retryAfter
    return Promise.reject(normalized)
  },
)

export async function apiGet(url, params, options = {}) {
  const { data } = await http.get(url, { params, ...options })
  return data
}

export async function apiPost(url, body, options = {}) {
  const { data } = await http.post(url, body, options)
  return data
}

export async function apiPut(url, body, options = {}) {
  const { data } = await http.put(url, body, options)
  return data
}

export async function apiPatch(url, body, options = {}) {
  const { data } = await http.patch(url, body, options)
  return data
}

export async function apiDelete(url, options = {}) {
  const { data } = await http.delete(url, options)
  return data
}

export default http
