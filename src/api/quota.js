/**
 * 每日额度 API 门面
 * 今日剩余次数与「哪一档先用尽」都来自 GET /api/quota（后端 md/35 §7.1）；
 * VITE_USE_MOCK 决定数据来源，视图只认返回的 DTO。
 */
import { config } from '../config'
import { mockQuota } from '../mock/adapter'
import { apiGet } from '../unit/request'

/**
 * 获取今日额度快照
 * 公开接口、不挂限流：进首页 / 设置页时调一次即可，生成后返回会重新挂载再取。
 * 返回 { day, resetAt, primary, blocking, breakdown }；remaining 归零的维度进 blocking。
 */
export function fetchQuota(options = {}) {
  if (config.useMock) return mockQuota.get(options)

  return apiGet('/quota', undefined, options)
}
