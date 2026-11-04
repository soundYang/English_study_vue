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

  it('should show the empty state instead of a blank block', async () => {
    const component = mountPopover({ phonetic: null, senses: [], facts: [] })
    await flushPromises()

    expect(component.get('.detail-status').text()).toBe('暂无释义')
    expect(component.find('.detail-facts').exists()).toBe(false)
    expect(component.find('.detail-phonetic').exists()).toBe(false)
  })

  it('should show the loading state and mark the dialog busy', async () => {
    const component = mountPopover({ senses: [], facts: [], loading: true })
    await flushPromises()

    expect(component.get('.detail-popover').attributes('aria-busy')).toBe('true')
    expect(component.get('[role="status"]').text()).toBe('正在查询释义…')
    expect(component.text()).not.toContain('暂无释义')
  })

  it('should show the error state and hide the empty placeholder', async () => {
    const component = mountPopover({
      senses: [],
      facts: [],
      error: '释义加载失败，再点一次可以重试。',
    })
    await flushPromises()

    expect(component.get('[role="alert"]').text()).toBe('释义加载失败，再点一次可以重试。')
    expect(component.text()).not.toContain('暂无释义')
  })

  it('should allow the caller to hide the empty state with an empty emptyText', async () => {
    const component = mountPopover({ senses: [], facts: [], emptyText: '' })
    await flushPromises()

    expect(component.find('.detail-block').exists()).toBe(false)
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

describe('WordDetailPopover · 定位', () => {
  const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
  const originalScrollHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'scrollHeight',
  )
  const originalViewport = window.innerHeight

  function mockViewport({ anchorTop, panelHeight = 400, panelScrollHeight = 0 }) {
    Object.defineProperty(window, 'innerHeight', { value: 700, configurable: true })
    // jsdom 不做布局：浮层按指定高度计算，其它元素维持 0
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        return this.classList?.contains('detail-popover') ? panelHeight : 0
      },
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() {
        return this.classList?.contains('detail-popover') ? panelScrollHeight : 0
      },
    })
    anchor.getBoundingClientRect = () => ({
      top: anchorTop,
      bottom: anchorTop + 30,
      left: 100,
      right: 200,
      width: 100,
      height: 30,
      x: 100,
      y: anchorTop,
      toJSON: () => ({}),
    })
  }

  afterEach(() => {
    if (originalHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalHeight)
    if (originalScrollHeight)
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight)
    Object.defineProperty(window, 'innerHeight', { value: originalViewport, configurable: true })
  })

  it('should open upward for anchors in the lower half and keep the facts inside the viewport', async () => {
    mockViewport({ anchorTop: 650 })

    const component = mountPopover({ senses: [], facts: [], loading: true })
    await flushPromises()

    await component.setProps({ loading: false, senses: SENSES })
    await flushPromises()

    const panel = component.get('.detail-popover').element
    // 锚点下方只有 20px，改向上展开：底边钉在锚点上方，内容变高只会往上长
    expect(panel.style.top).toBe('auto')
    expect(panel.style.bottom).toBe('60px')
    expect(panel.style.maxHeight).toBe('628px')
  })

  it('should open downward for anchors in the upper half', async () => {
    mockViewport({ anchorTop: 100 })

    const component = mountPopover()
    await flushPromises()

    const panel = component.get('.detail-popover').element
    expect(panel.style.top).toBe('100px')
    expect(panel.style.bottom).toBe('auto')
    // top(100) + max-height(588) + 底部留白(12) = 视口底边
    expect(panel.style.maxHeight).toBe('588px')
  })

  it('should lift the panel so taller content fits above the viewport bottom', async () => {
    // 可见高度被 max-height 截成 388，但内容真实高度是 500
    mockViewport({ anchorTop: 300, panelHeight: 388, panelScrollHeight: 500 })

    const component = mountPopover()
    await flushPromises()

    const panel = component.get('.detail-popover').element
    // 内容真实高度 500 + 上下边框 2，把 top 从 300 抬到 700 - 502 - 12，底边仍留在视口内
    expect(panel.style.top).toBe('186px')
    expect(panel.style.maxHeight).toBe('502px')
  })

  it('should cap the height by the final top even before the panel height is measurable', async () => {
    mockViewport({ anchorTop: 300, panelHeight: 0 })

    const component = mountPopover()
    await flushPromises()

    const panel = component.get('.detail-popover').element
    // 量不到高度时也按 top=300 封顶，异步内容不会把底边顶出视口
    expect(panel.style.top).toBe('300px')
    expect(panel.style.maxHeight).toBe('388px')
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
