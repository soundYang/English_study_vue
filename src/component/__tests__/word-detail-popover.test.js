/**
 * 单词详情浮层测试
 * 覆盖内容渲染、空字段隐藏、Esc / 点外部关闭、焦点归还与窄屏抽屉形态。
 * Teleport 用 stub 留在 wrapper 内，锚点用真实按钮挂到 body 上。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import WordDetailPopover from '../WordDetailPopover.vue'

const SENSES = [
  { pos: 'v.', meaning: '放弃；抛弃' },
  { pos: 'n.', meaning: '放纵' },
]

const FACTS = [
  { label: '来源', value: '词库' },
  { label: '收录', value: '2026-10-01' },
]

let anchor = null
let wrapper = null

function makeAnchor() {
  const button = document.createElement('button')
  button.textContent = 'abandon'
  document.body.appendChild(button)
  return button
}

function mountPopover(props = {}) {
  wrapper = mount(WordDetailPopover, {
    attachTo: document.body,
    global: { stubs: { teleport: true } },
    props: {
      open: true,
      anchor,
      word: 'abandon',
      phonetic: { uk: '/əˈbæn.dən/', us: '/əˈbæn.dɑːn/' },
      senses: SENSES,
      facts: FACTS,
      ...props,
    },
  })
  return wrapper
}

beforeEach(() => {
  anchor = makeAnchor()
})

afterEach(() => {
  if (wrapper) wrapper.unmount()
  wrapper = null
  anchor?.remove()
  anchor = null
  document.body.innerHTML = ''
})

describe('WordDetailPopover · 内容', () => {
  it('should render the word, both phonetics, every sense and the facts', async () => {
    const component = mountPopover()
    await flushPromises()

    const panel = component.get('.detail-popover')

    expect(panel.attributes('role')).toBe('dialog')
    expect(panel.attributes('aria-label')).toBe('“abandon” 的详细信息')
    expect(panel.get('.detail-word').text()).toBe('abandon')
    expect(panel.findAll('.phonetic-part')).toHaveLength(2)
    expect(panel.findAll('.detail-sense')).toHaveLength(2)
    expect(panel.text()).toContain('放弃；抛弃')
    expect(panel.text()).toContain('放纵')
    expect(panel.text()).toContain('来源')
    expect(panel.text()).toContain('2026-10-01')
  })

  it('should hide the empty blocks instead of rendering placeholders', async () => {
    const component = mountPopover({ phonetic: null, senses: [], facts: [] })
    await flushPromises()

    expect(component.find('.detail-block').exists()).toBe(false)
    expect(component.find('.detail-facts').exists()).toBe(false)
    expect(component.find('.detail-phonetic').exists()).toBe(false)
  })

  it('should render the badges slot next to the word', async () => {
    wrapper = mount(WordDetailPopover, {
      attachTo: document.body,
      global: { stubs: { teleport: true } },
      props: {
        open: true,
        anchor,
        word: 'abandon',
        phonetic: null,
        senses: SENSES,
        facts: FACTS,
      },
      slots: { badges: '<span class="test-badge">学习中</span>' },
    })
    await flushPromises()

    expect(wrapper.get('.detail-title-row').text()).toContain('学习中')
  })
})

describe('WordDetailPopover · 关闭', () => {
  it('should close on Escape and give focus back to the anchor', async () => {
    const component = mountPopover()
    await flushPromises()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    expect(component.emitted('update:open')).toEqual([[false]])
    expect(document.activeElement).toBe(anchor)
  })

  it('should close when clicking outside without stealing focus', async () => {
    const component = mountPopover()
    await flushPromises()
    anchor.focus()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flushPromises()

    expect(component.emitted('update:open')).toEqual([[false]])
    expect(document.activeElement).toBe(anchor)
  })

  it('should stay open when clicking inside the panel or on the anchor', async () => {
    const component = mountPopover()
    await flushPromises()

    component
      .get('.detail-popover')
      .element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    anchor.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flushPromises()

    expect(component.emitted('update:open')).toBeUndefined()
  })
})

describe('WordDetailPopover · 窄屏', () => {
  it('should switch to a bottom sheet under 640px', async () => {
    const original = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true })

    const component = mountPopover()
    await flushPromises()

    expect(component.get('.detail-popover').classes()).toContain('is-sheet')

    Object.defineProperty(window, 'innerWidth', { value: original, configurable: true })
  })
})
