/**
 * 运行配置
 * 集中读取并校验 Vite 环境变量，其他模块不直接访问 import.meta.env。
 */
// 兜底用相对路径：dev 由 vite 的 server.proxy 转发到本机后端，生产由 nginx 反代，
// 两处都不需要知道后端地址；写成绝对地址会让手机联调打到访问者自己的 localhost（md/22 第 87 行）
const DEFAULT_API_BASE_URL = '/api'
const REQUEST_TIMEOUT = 15000
// AI 生成需要 20-60 秒，必须单独放宽；后端上游超时为 60 秒，这里留 30 秒余量
const GENERATE_TIMEOUT = 90000
// 文件解析（含图片 OCR）可能冷启动，默认 15 秒不够；后端解析上限 5MB
const IMPORT_TIMEOUT = 30000
// AI 整理模式后端最坏 45 秒（分片多次调用模型），前端必须放到 60 秒：
// 沿用 30 秒会让后端还在跑、前端先报网络错误，用户重试会重复消耗他的 Key 额度（md/49 §13）
const IMPORT_AI_TIMEOUT = 60000

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).trim()
const useMock = import.meta.env.VITE_USE_MOCK !== 'false'
const apiBaseUrl = rawBaseUrl.replace(/\/+$/, '')
// 与后端 AUTH_ENFORCED 一一对应：表示匿名 API 是否返回 401。
// 前端路由门禁由 meta.public 决定，不再依赖这个开关（md/42）。
const authEnforced = import.meta.env.VITE_AUTH_ENFORCED === 'true'

export const config = Object.freeze({
  apiBaseUrl,
  useMock,
  authEnforced,
  requestTimeout: REQUEST_TIMEOUT,
  generateTimeout: GENERATE_TIMEOUT,
  importTimeout: IMPORT_TIMEOUT,
  importAiTimeout: IMPORT_AI_TIMEOUT,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
})

export default config
