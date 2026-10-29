/**
 * 个人中心 API 门面
 * 当前用户资料、改密码、统计与自备 API Key 统一从这里进入；VITE_USE_MOCK 决定数据来源。
 * 口径与字段形状见 English_node/md/33 §6.2、§9.2 与 md/43 §5。
 */
import { config } from '../config'
import { mockApiKey, mockProfile } from '../mock/adapter'
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../unit/request'

/** 当前用户资料；后端不返回 dataKey / passwordHash / usernameLower */
export function fetchProfile(options = {}) {
  if (config.useMock) return mockProfile.get()
  return apiGet('/profile', undefined, options)
}

/** 改昵称 / 个性签名；未传的字段保持原值 */
export function updateProfile(patch, options = {}) {
  if (config.useMock) return mockProfile.update(patch)
  return apiPatch('/profile', patch, options)
}

/** 改密码；成功后后端保留当前会话、踢掉其它设备 */
export function changePassword(payload, options = {}) {
  if (config.useMock) return mockProfile.changePassword(payload)
  return apiPost('/profile/password', payload, options)
}

/** 个人中心统计：已完成文章、按题正确率、累计 token 与近 12 周柱状图 */
export function fetchProfileStats(options = {}) {
  if (config.useMock) return mockProfile.stats()
  return apiGet('/profile/stats', undefined, options)
}

/**
 * 自备 API Key 状态
 * 返回 { enabled, supportedProviders, key }；key === null 表示没导入过，
 * enabled === false 表示服务端没开功能，个人中心整块隐藏（md/43 §5.1）。
 */
export function fetchApiKey(options = {}) {
  if (config.useMock) return mockApiKey.get()
  return apiGet('/profile/api-key', undefined, options)
}

/**
 * 导入 / 替换 API Key
 * 后端先向 DeepSeek 校验再落库；校验失败不会动旧 Key，响应与 GET 同形状。
 */
export function saveApiKey(payload, options = {}) {
  if (config.useMock) return mockApiKey.save(payload)
  return apiPut('/profile/api-key', payload, options)
}

/** 删除 API Key，幂等；删除后下一次生成回到免费额度 */
export function deleteApiKey(options = {}) {
  if (config.useMock) return mockApiKey.remove()
  return apiDelete('/profile/api-key', options)
}

/** 重新校验已存的 Key；成功刷新 lastVerifiedAt，上游拒绝时把状态置为 invalid */
export function verifyApiKey(options = {}) {
  if (config.useMock) return mockApiKey.verify()
  return apiPost('/profile/api-key/verify', undefined, options)
}
