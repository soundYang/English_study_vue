/**
 * API 设置卡测试
 * 锁住：enabled=false 整块隐藏、未导入 / 已导入两态、只展示掩码、
 * 错误按 code 落到输入框或卡片、重新校验失败同步状态、删除要二次确认。
 * 接口层用 vi.mock 控制每次响应，不依赖 mock adapter 的校验分支。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ApiSettings from '../component/ApiSettings.vue'
import { BusinessError } from '../../../errors'
import { useToastStore } from '../../../stores/model/toast'

vi.mock('../../../api/profile', () => ({
  fetchApiKey: vi.fn(),
  saveApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  verifyApiKey: vi.fn(),
}))

import { deleteApiKey, fetchApiKey, saveApiKey, verifyApiKey } from '../../../api/profile'

const VALID_KEY = `sk-${'a'.repeat(40)}`
const EMPTY = { enabled: true, supportedProviders: ['deepseek'], key: null }
const IMPORTED = {
  enabled: true,
  supportedProviders: ['deepseek'],
  key: {
    provider: 'deepseek',
    maskedKey: 'sk-****9f3a',
    status: 'active',
    createdAt: '2026-10-29T03:12:00.000Z',
    updatedAt: '2026-10-29T03:12:00.000Z',
    lastVerifiedAt: '2026-10-29T03:12:00.000Z',
    lastUsedAt: null,
  },
}

let wrapper = null

function mountCard() {
  const pinia = createPinia()
  setActivePinia(pinia)

  wrapper = mount(ApiSettings, { global: { plugins: [pinia] } })
  return wrapper
}

function findButton(text) {
  return wrapper.findAll('button').find((button) => button.text().includes(text))
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchApiKey.mockResolvedValue(EMPTY)
  saveApiKey.mockResolvedValue(IMPORTED)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('ApiSettings', () => {
  it('should hide the whole card when the server does not enable the feature', async () => {
    fetchApiKey.mockResolvedValue({ enabled: false, supportedProviders: [], key: null })

    mountCard()
    await flushPromises()

    expect(wrapper.find('.api-settings').exists()).toBe(false)
  })

  it('should import a key and only render its mask afterwards', async () => {
    mountCard()
    await flushPromises()

    await wrapper.get('input[name="apiKey"]').setValue(VALID_KEY)
    await wrapper.get('form.api-form').trigger('submit')
    await flushPromises()

    expect(saveApiKey).toHaveBeenCalledWith({ provider: 'deepseek', apiKey: VALID_KEY })
    expect(wrapper.get('.api-key-mask').text()).toBe('sk-****9f3a')
    // 完整 Key 不留在页面上（输入框已清空）
    expect(wrapper.text()).not.toContain(VALID_KEY)
    expect(wrapper.find('input[name="apiKey"]').exists()).toBe(false)
    expect(useToastStore().items.map((item) => item.message)).toContain('API Key 已导入')
  })

  it('should tell users where to create a DeepSeek key', async () => {
    mountCard()
    await flushPromises()

    const link = wrapper.get('a.api-help-link')

    expect(link.attributes('href')).toBe('https://platform.deepseek.com/api_keys')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
    expect(wrapper.text()).toContain('创建 API Key')
    expect(wrapper.text()).toContain('Key 只显示一次')
  })

  it('should keep the typed key when the server rejects it on the apiKey field', async () => {
    saveApiKey.mockRejectedValue(
      new BusinessError('这把 API Key 无效或已过期，请检查后重新导入', 'USER_API_KEY_INVALID', {
        field: 'apiKey',
      }),
    )

    mountCard()
    await flushPromises()

    await wrapper.get('input[name="apiKey"]').setValue(VALID_KEY)
    await wrapper.get('form.api-form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('.input-message.is-error').text()).toContain('无效或已过期')
    // 失败不清空已填内容，用户改一两个字符就能重试
    expect(wrapper.get('input[name="apiKey"]').element.value).toBe(VALID_KEY)
    expect(wrapper.find('.api-key-mask').exists()).toBe(false)
  })

  it('should explain a verification timeout without changing the key', async () => {
    saveApiKey.mockRejectedValue(
      new BusinessError('upstream timeout', 'USER_API_KEY_VERIFY_FAILED', {}),
    )

    mountCard()
    await flushPromises()

    await wrapper.get('input[name="apiKey"]').setValue(VALID_KEY)
    await wrapper.get('form.api-form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('.input-message.is-error').text()).toBe(
      '暂时无法验证这把 API Key，请稍后再试。',
    )
  })

  it('should show an invalid stored key with the replacement hint', async () => {
    fetchApiKey.mockResolvedValue({
      ...IMPORTED,
      key: { ...IMPORTED.key, status: 'invalid' },
    })

    mountCard()
    await flushPromises()

    expect(wrapper.get('.api-key-mask').text()).toBe('sk-****9f3a')
    expect(wrapper.get('.api-status').text()).toBe('已失效')
    expect(wrapper.text()).toContain('请重新导入')
    expect(wrapper.text()).toContain('更新于')
  })

  it('should mark the key invalid when re-verification is rejected upstream', async () => {
    fetchApiKey.mockResolvedValue(IMPORTED)
    verifyApiKey.mockRejectedValue(
      new BusinessError('这把 API Key 无效或已过期，请检查后重新导入', 'USER_API_KEY_INVALID', {
        field: 'apiKey',
      }),
    )

    mountCard()
    await flushPromises()

    await findButton('重新校验').trigger('click')
    await flushPromises()

    expect(wrapper.get('.api-status').text()).toBe('已失效')
    expect(wrapper.text()).toContain('无效或已过期')
    // 校验失败不删 Key，等用户替换
    expect(wrapper.find('.api-key-mask').exists()).toBe(true)
  })

  it('should fall back to the import form when the stored key is gone', async () => {
    fetchApiKey.mockResolvedValueOnce(IMPORTED).mockResolvedValue(EMPTY)
    verifyApiKey.mockRejectedValue(
      new BusinessError('还没有导入 API Key', 'USER_API_KEY_MISSING', {}),
    )

    mountCard()
    await flushPromises()

    await findButton('重新校验').trigger('click')
    await flushPromises()

    expect(wrapper.find('.api-key-mask').exists()).toBe(false)
    expect(wrapper.find('input[name="apiKey"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('这把 Key 已经不在了')
  })

  it('should require a second confirmation before deleting', async () => {
    fetchApiKey.mockResolvedValue(IMPORTED)
    deleteApiKey.mockResolvedValue({ ok: true, key: null })

    mountCard()
    await flushPromises()

    await findButton('删除').trigger('click')
    expect(wrapper.text()).toContain('确定删除这把 Key 吗')

    await findButton('确认删除').trigger('click')
    await flushPromises()

    expect(deleteApiKey).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.api-key-mask').exists()).toBe(false)
    expect(wrapper.find('input[name="apiKey"]').exists()).toBe(true)
    expect(useToastStore().items.map((item) => item.message)).toContain('API Key 已删除')
  })

  it('should grey the card out when a write hits the disabled feature', async () => {
    saveApiKey.mockRejectedValue(
      new BusinessError('自备 API Key 功能暂未开启', 'USER_API_KEY_DISABLED', {}),
    )

    mountCard()
    await flushPromises()

    await wrapper.get('input[name="apiKey"]').setValue(VALID_KEY)
    await wrapper.get('form.api-form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('自备 API Key 功能暂未开启')
    expect(wrapper.find('input[name="apiKey"]').exists()).toBe(false)
    expect(wrapper.get('.card-badge').text()).toBe('暂未开放')
  })

  it('should show a retry when the status request fails', async () => {
    fetchApiKey.mockRejectedValueOnce(new BusinessError('服务暂时不可用', 'INTERNAL_ERROR', {}))
    fetchApiKey.mockResolvedValueOnce(IMPORTED)

    mountCard()
    await flushPromises()

    expect(wrapper.text()).toContain('服务暂时不可用')

    await findButton('重试').trigger('click')
    await flushPromises()

    expect(wrapper.get('.api-key-mask').text()).toBe('sk-****9f3a')
  })
})
