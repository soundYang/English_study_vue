/**
 * 阅读 API 门面
 * 词汇生成、详情、提交与历史统计统一从这里进入；VITE_USE_MOCK 决定数据来源。
 */
import { config } from '../config'
import { mockReadings } from '../mock/adapter'
import { apiGet, apiPost } from '../unit/request'

/** 生成阅读材料，返回安全 DTO（不含翻译、正确答案与解析） */
export function generateReading(payload, options = {}) {
  if (config.useMock) return mockReadings.generate(payload, options)
  // 生成是唯一的长耗时接口：单独放宽超时，signal 仍可随时中断
  return apiPost('/readings/generate', payload, { timeout: config.generateTimeout, ...options })
}

/** 获取阅读详情：未提交返回安全 DTO，已提交返回含答案与翻译的完整结果 */
export function fetchReading(id, options = {}) {
  if (config.useMock) return mockReadings.get(id)
  return apiGet(`/readings/${id}`, undefined, options)
}

/** 提交答案；重复提交由后端返回 ALREADY_SUBMITTED */
export function submitReading(id, answers, options = {}) {
  if (config.useMock) return mockReadings.submit(id, answers)
  return apiPost(`/readings/${id}/submit`, { answers }, options)
}

/** 获取历史记录与统计；未提交记录不返回判分信息 */
export function fetchHistory(params = {}) {
  if (config.useMock) return mockReadings.history(params)
  return apiGet('/readings/history', params)
}
