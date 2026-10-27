/**
 * HTTP 请求客户端
 * Axios 实例与拦截器：注入 token、GET 防缓存、统一错误归一化。
 * 只负责请求，不做 UI 提示；由 store / 视图决定如何展示错误。
 * 当前 VITE_USE_MOCK=true 时该模块不参与请求，但保持可用以便一键切换后端。
 */
import axios from 'axios'
import { config } from '../config'
import { normalizeApiError } from '../errors'
import { localStore } from './storage'

const http = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: config.requestTimeout,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((requestConfig) => {
  const token = localStore.get('accessToken', '')
  if (token) requestConfig.headers.Authorization = `Bearer ${token}`

  // GET 附加时间戳，避免浏览器或代理缓存旧数据
  if (requestConfig.method === 'get') {
    requestConfig.params = { ...(requestConfig.params || {}), _t: Date.now() }
  }
  return requestConfig
})

// 401 只清理 token 并抛出 AuthError，不在此处跳转：MVP 没有登录页，导航由调用方决定
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) localStore.remove('accessToken')
    return Promise.reject(normalizeApiError(error))
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
