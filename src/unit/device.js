/**
 * 设备标识
 *
 * 用途：给每个浏览器生成一次随机 ID，随请求带 `X-Device-Id`，供后端做设备维度的每日额度。
 *       这是随机 ID，不是浏览器指纹：不读 canvas / 字体 / 硬件信息，也不做跨站关联。
 *       无痕窗口或换浏览器会拿到新 ID，由后端的网络指纹桶兜底（md/35 §3.3）。
 * 用法：getDeviceId()——首次调用生成并落盘，之后一直返回同一个值。
 */
import { localStore, storageKeys } from './storage'

// 与后端同口径：16–64 位 [A-Za-z0-9_-]；太短的值没有区分度，后端会直接忽略
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

// 模块级缓存：即使 localStorage 被禁用（隐私模式），同一次页面生命周期里也保持稳定
let cached = ''

function randomHex() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return randomHex()
  }

  // 极端环境（没有 Web Crypto）：时间 + 随机数，只求不重复，不用于任何安全用途
  return `dev${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

/**
 * 当前浏览器的设备 ID
 * 已存的旧值不合法（被手改过、太短）时重新生成，否则后端会把它当没传。
 */
export function getDeviceId() {
  if (cached) return cached

  const stored = localStore.get(storageKeys.deviceId, '')
  if (typeof stored === 'string' && DEVICE_ID_PATTERN.test(stored)) {
    cached = stored
    return cached
  }

  const created = createId()
  const deviceId = DEVICE_ID_PATTERN.test(created) ? created : randomHex()

  localStore.set(storageKeys.deviceId, deviceId)
  cached = deviceId

  return cached
}
