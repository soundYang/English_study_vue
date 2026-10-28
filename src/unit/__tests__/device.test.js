/**
 * 设备 ID 测试
 * 后端只接受 16–64 位 [A-Za-z0-9_-]，且同一个浏览器刷新后必须还是同一个值；
 * 太短或带非法字符的旧值会被后端静默忽略，前端要能自己纠正。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { localStore, storageKeys } from '../storage'

const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

beforeEach(() => {
  localStorage.clear()
  // getDeviceId 有模块级缓存，每个用例重新加载模块才能从空存储开始
  vi.resetModules()
})

describe('getDeviceId', () => {
  it('should create a header-safe id once and keep it within the page', async () => {
    const { getDeviceId } = await import('../device')

    const first = getDeviceId()
    const second = getDeviceId()

    expect(first).toBe(second)
    expect(first).toMatch(DEVICE_ID_PATTERN)
    expect(localStore.get(storageKeys.deviceId)).toBe(first)
  })

  it('should reuse the id stored by an earlier page load', async () => {
    localStore.set(storageKeys.deviceId, 'abcdefghijklmnop1234')

    const { getDeviceId } = await import('../device')

    expect(getDeviceId()).toBe('abcdefghijklmnop1234')
  })

  it('should replace a stored value the backend would ignore', async () => {
    localStore.set(storageKeys.deviceId, 'abc')

    const { getDeviceId } = await import('../device')
    const id = getDeviceId()

    expect(id).not.toBe('abc')
    expect(id).toMatch(DEVICE_ID_PATTERN)
    expect(localStore.get(storageKeys.deviceId)).toBe(id)
  })
})
