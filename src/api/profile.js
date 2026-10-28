/**
 * 个人中心 API 门面
 * 当前用户资料、改密码与统计统一从这里进入；VITE_USE_MOCK 决定数据来源。
 * 口径与字段形状见 English_node/md/33 §6.2、§9.2。
 */
import { config } from '../config'
import { mockProfile } from '../mock/adapter'
import { apiGet, apiPatch, apiPost } from '../unit/request'

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
