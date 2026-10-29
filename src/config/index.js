/**
 * 运行配置
 * 集中读取并校验 Vite 环境变量，其他模块不直接访问 import.meta.env。
 */
const DEFAULT_API_BASE_URL = 'http://localhost:3000/api'
const REQUEST_TIMEOUT = 15000
// AI 生成需要 20-60 秒，必须单独放宽；后端上游超时为 60 秒，这里留 30 秒余量
const GENERATE_TIMEOUT = 90000
// 文件解析（含图片 OCR）可能冷启动，默认 15 秒不够；后端解析上限 5MB
const IMPORT_TIMEOUT = 30000

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).trim()
const useMock = import.meta.env.VITE_USE_MOCK !== 'false'
const apiBaseUrl = rawBaseUrl.replace(/\/+$/, '')
// 与后端 AUTH_ENFORCED 一一对应：true 时没有令牌的访问会被路由守卫送到 /login
const authEnforced = import.meta.env.VITE_AUTH_ENFORCED === 'true'

export const config = Object.freeze({
  apiBaseUrl,
  useMock,
  authEnforced,
  requestTimeout: REQUEST_TIMEOUT,
  generateTimeout: GENERATE_TIMEOUT,
  importTimeout: IMPORT_TIMEOUT,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
})

export default config
