/**
 * 基础组件冒烟测试
 * 覆盖 F2 组件的核心交互与无障碍属性，避免只靠人工预览验收。
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BaseButton from '../BaseButton.vue'
import BaseInput from '../BaseInput.vue'
import BaseModal from '../BaseModal.vue'
import PaginationBar from '../PaginationBar.vue'
import SegmentedControl from '../SegmentedControl.vue'
import StatusPill from '../StatusPill.vue'
import { useToastStore } from '../../stores/model/toast'

describe('BaseButton', () => {
  it('should emit click when enabled', async () => {
    const wrapper = mount(BaseButton, { slots: { default: '保存' } })

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('should not emit click when loading and mark aria-busy', async () => {
    const wrapper = mount(BaseButton, { props: { loading: true } })

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toBeUndefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.attributes('disabled')).toBeDefined()
  })
})

describe('BaseInput', () => {
  it('should emit input value and link error text', async () => {
    const wrapper = mount(BaseInput, {
      props: { modelValue: '', label: '英文单词', error: '这个单词已经在词库中了' },
    })

    await wrapper.find('input').setValue('apple')

    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['apple'])
    expect(wrapper.find('input').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('[role="alert"]').text()).toBe('这个单词已经在词库中了')
    expect(wrapper.find('input').attributes('aria-describedby')).toContain('-error')
  })
})

describe('StatusPill', () => {
  it('should render learning status labels', () => {
    const wrapper = mount(StatusPill, { props: { kind: 'status', value: 'mastered' } })

    expect(wrapper.text()).toContain('已掌握')
  })

  it('should render level labels', () => {
    const wrapper = mount(StatusPill, { props: { kind: 'level', value: 'hard' } })

    expect(wrapper.text()).toContain('挑战')
  })
})

describe('SegmentedControl', () => {
  it('should mark active option and emit change', async () => {
    const wrapper = mount(SegmentedControl, {
      props: {
        modelValue: 3,
        options: [
          { value: 3, label: '3 题' },
          { value: 5, label: '5 题' },
        ],
      },
    })

    const buttons = wrapper.findAll('[role="radio"]')
    expect(buttons[0].attributes('aria-checked')).toBe('true')
    expect(buttons[1].attributes('aria-checked')).toBe('false')

    await buttons[1].trigger('click')

    expect(wrapper.emitted('update:modelValue')[0]).toEqual([5])
  })
})

describe('PaginationBar', () => {
  it('should mark current page and emit next page', async () => {
    const wrapper = mount(PaginationBar, { props: { page: 2, total: 120, pageSize: 10 } })

    expect(wrapper.find('.is-current').text()).toBe('2')

    await wrapper.find('[aria-label="下一页"]').trigger('click')

    expect(wrapper.emitted('update:page')[0]).toEqual([3])
  })

  it('should disable previous button on first page', () => {
    const wrapper = mount(PaginationBar, { props: { page: 1, total: 5, pageSize: 10 } })

    expect(wrapper.find('[aria-label="上一页"]').attributes('disabled')).toBeDefined()
  })
})

describe('BaseModal', () => {
  it('should render dialog when opened and emit close on Escape', async () => {
    const wrapper = mount(BaseModal, {
      props: { open: false, title: '编辑单词' },
      attachTo: document.body,
    })

    await wrapper.setProps({ open: true })
    await nextTick()

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog.getAttribute('aria-modal')).toBe('true')

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
})

describe('toast store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should keep at most 3 toasts and auto remove after 3s', () => {
    const store = useToastStore()

    store.push({ message: 'a' })
    store.push({ message: 'b' })
    store.push({ message: 'c' })
    store.push({ message: 'd' })

    expect(store.items).toHaveLength(3)
    expect(store.items.map((item) => item.message)).toEqual(['b', 'c', 'd'])

    vi.advanceTimersByTime(3000)

    expect(store.items).toHaveLength(0)
  })
})
