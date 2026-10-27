/**
 * 运行配置
 * 集中读取并校验 Vite 环境变量，其他模块不直接访问 import.meta.env。
 */
const DEFAULT_API_BASE_URL = 'http://localhost:3000/api'
const REQUEST_TIMEOUT = 15000

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).trim()
const useMock = import.meta.env.VITE_USE_MOCK !== 'false'
const apiBaseUrl = rawBaseUrl.replace(/\/+$/, '')

export const config = Object.freeze({
  apiBaseUrl,
  useMock,
  requestTimeout: REQUEST_TIMEOUT,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
})

export default config
