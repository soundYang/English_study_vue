/**
 * 鉴权接口
 * 负责图形验证码、注册、登录与退出（md/33 §6.1）。
 * Mock 与真实后端返回同一形状：token + expiresAt + user，错误码也一致，
 * 页面层只认 code，不关心当前跑在哪一种数据源上。
 */
import { config } from '../config'
import { mockAuth } from '../mock/adapter'
import { apiPost } from '../unit/request'

/** 下发图形验证码 → { captchaId, svg, expiresIn } */
export function fetchCaptcha(options = {}) {
  if (config.useMock) return mockAuth.captcha()
  return apiPost('/auth/captcha', undefined, options)
}

/** 注册，成功即登录 → { token, expiresAt, user } */
export function registerAccount(payload, options = {}) {
  if (config.useMock) return mockAuth.register(payload)
  return apiPost('/auth/register', payload, options)
}

/** 登录 → { token, expiresAt, user } */
export function loginAccount(payload, options = {}) {
  if (config.useMock) return mockAuth.login(payload)
  return apiPost('/auth/login', payload, options)
}

/** 退出，幂等；令牌由请求拦截器自动带上 */
export function logoutAccount(options = {}) {
  if (config.useMock) return mockAuth.logout()
  return apiPost('/auth/logout', undefined, options)
}
