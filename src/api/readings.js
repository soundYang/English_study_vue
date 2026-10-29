/**
 * 阅读 API 门面
 * 生成任务、阅读详情、提交与历史统计统一从这里进入；VITE_USE_MOCK 决定数据来源。
 */
import { config } from '../config'
import { mockReadings } from '../mock/adapter'
import { pathSegment } from '../unit/path'
import { apiGet, apiPost } from '../unit/request'

/**
 * 生成阅读材料（旧同步接口）
 * 保留给兼容与回归测试；生成动画一律走 createGenerationTask，用它会阻塞到全文就绪。
 */
export function generateReading(payload, options = {}) {
  if (config.useMock) return mockReadings.generate(payload, options)
  // 生成是唯一的长耗时接口：单独放宽超时，signal 仍可随时中断
  return apiPost('/readings/generate', payload, { timeout: config.generateTimeout, ...options })
}

/**
 * 建生成任务：202 立刻返回 taskId，生成在后台跑（后端 md/31 §3.1）
 * clientToken 由「一次用户点击」生成，重复提交复用同一个 token 不会扣两次钱。
 */
export function createGenerationTask(payload, options = {}) {
  if (config.useMock) return mockReadings.createTask(payload, options)
  return apiPost('/readings/generate/tasks', payload, options)
}

/** 轮询任务：只读、不限流；返回完整任务 DTO（status / stage / progress / segments…） */
export function fetchGenerationTask(taskId, options = {}) {
  if (config.useMock) return mockReadings.getTask(taskId, options)
  return apiGet(`/readings/generate/tasks/${pathSegment(taskId)}`, undefined, options)
}

/** 取消任务：不回收已写好的段，语义是「不再继续付费」；终态再调是 no-op */
export function cancelGenerationTask(taskId, options = {}) {
  if (config.useMock) return mockReadings.cancelTask(taskId, options)
  return apiPost(`/readings/generate/tasks/${pathSegment(taskId)}/cancel`, undefined, options)
}

/** 重试任务：只接受 failed / cancelled，复用已写好的段，不重新规划 */
export function retryGenerationTask(taskId, options = {}) {
  if (config.useMock) return mockReadings.retryTask(taskId, options)
  return apiPost(`/readings/generate/tasks/${pathSegment(taskId)}/retry`, undefined, options)
}

/** 生成前预检：三档门禁、可用词数与篇幅上限；不发 AI 请求，可随参数变化频繁调用 */
export function fetchCapacity(params = {}, options = {}) {
  if (config.useMock) return mockReadings.capacity(params, options)

  // vocabScope 是数组，axios 默认会拼成 vocabScope[]=…，后端 zod 只认 vocabScope，
  // 会静默按默认值当成全量；indexes: null 输出重复键，Express 才能解析成数组
  return apiGet('/readings/capacity', params, { paramsSerializer: { indexes: null }, ...options })
}

/** 获取阅读详情：未提交返回安全 DTO，已提交返回含答案与翻译的完整结果 */
export function fetchReading(id, options = {}) {
  if (config.useMock) return mockReadings.get(id)
  return apiGet(`/readings/${pathSegment(id)}`, undefined, options)
}

/** 提交答案；重复提交由后端返回 ALREADY_SUBMITTED */
export function submitReading(id, answers, options = {}) {
  if (config.useMock) return mockReadings.submit(id, answers)
  return apiPost(`/readings/${pathSegment(id)}/submit`, { answers }, options)
}

/** 获取历史记录与统计；未提交记录不返回判分信息 */
export function fetchHistory(params = {}) {
  if (config.useMock) return mockReadings.history(params)
  return apiGet('/readings/history', params)
}
