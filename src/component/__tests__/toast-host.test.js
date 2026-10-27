/**
 * Toast 容器无障碍测试
 * 验证错误提示使用 assertive 直播区域、普通提示保持 polite，
 * 避免错误信息被排在后续提示之后播报。
 */
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import ToastHost from '../ToastHost.vue'
import { useToastStore } from '../../stores/model/toast'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('ToastHost', () => {
  it('should announce errors assertively and others politely', async () => {
    const store = useToastStore()
    store.push({ type: 'error', message: '提交失败，请重试' })
    store.push({ type: 'success', message: '已添加 apple' })

    const wrapper = mount(ToastHost, { global: { stubs: { teleport: true } } })
    await nextTick()

    const items = wrapper.findAll('.toast')
    expect(items).toHaveLength(2)

    expect(items[0].attributes('role')).toBe('alert')
    expect(items[0].attributes('aria-live')).toBe('assertive')
    expect(items[0].text()).toContain('提交失败，请重试')

    expect(items[1].attributes('role')).toBe('status')
    expect(items[1].attributes('aria-live')).toBe('polite')

    wrapper.unmount()
  })

  it('should expose a labelled close button', async () => {
    const store = useToastStore()
    store.push({ type: 'info', message: '已保存' })

    const wrapper = mount(ToastHost, { global: { stubs: { teleport: true } } })
    await nextTick()

    expect(wrapper.get('.toast-close').attributes('aria-label')).toBe('关闭提示')
    wrapper.unmount()
  })
})
