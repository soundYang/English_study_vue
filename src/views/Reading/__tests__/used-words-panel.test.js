/**
 * 本文用到的词面板测试
 * 覆盖空数组不渲染、按 kind 分组、次数展示、pool 二次折叠与未知 kind 的兜底；
 * 数据口径见 md/56 §15：数组已由后端排好，组件不排序、不查状态。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import UsedWordsPanel from '../component/UsedWordsPanel.vue'

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }))

vi.mock('../../../composables/useWordLookup', () => ({
  useWordLookup: () => ({ lookup: lookupMock, cancel: vi.fn() }),
}))

const WORDS = [
  { word: 'courage', count: 3, kind: 'focus' },
  { word: 'language', count: 1, kind: 'target' },
  { word: 'patient', count: 2, kind: 'pool' },
  // 后端未来若加了新 kind，前端按 pool 处理，不能整组丢掉
  { word: 'mystery', count: 1, kind: 'unknown' },
]

function mountPanel(props = {}, options = {}) {
  return mount(UsedWordsPanel, { props, ...options })
}

function mountClickable(props = {}) {
  return mountPanel(
    { words: WORDS, clickable: true, ...props },
    { attachTo: document.body, global: { stubs: { teleport: true } } },
  )
}

beforeEach(() => {
  lookupMock.mockReset()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('UsedWordsPanel', () => {
  it('should render nothing when the article has no used words', () => {
    expect(mountPanel({ words: [] }).find('.used-words').exists()).toBe(false)
    expect(mountPanel().find('.used-words').exists()).toBe(false)
  })

  it('should keep the backend order and group words by kind', async () => {
    const wrapper = mountPanel({ words: WORDS })
    const toggle = wrapper.get('.used-toggle')

    expect(toggle.text()).toContain('本文用到了 4 个你的单词')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.used-body').exists()).toBe(false)

    await toggle.trigger('click')

    expect(toggle.attributes('aria-expanded')).toBe('true')
    const labels = wrapper.findAll('.group-label').map((node) => node.text())
    expect(labels).toEqual(['重点词', '目标词', '顺带复习的 2 个词'])

    // 同一组内保持入参顺序，前端不重排
    expect(wrapper.findAll('.chip.is-focus').map((node) => node.text())).toEqual(['courage'])
    expect(wrapper.findAll('.chip.is-target').map((node) => node.text())).toEqual(['language'])
    expect(wrapper.findAll('.chip.is-pool').map((node) => node.text())).toEqual([
      'patient',
      'mystery',
    ])
  })

  it('should show the occurrence count next to each word', async () => {
    const wrapper = mountPanel({ words: WORDS })
    await wrapper.get('.used-toggle').trigger('click')

    const counts = wrapper.findAll('.chip-count')
    expect(counts.map((node) => node.text())).toEqual(['×3', '×1', '×2', '×1'])
    expect(counts[0].attributes('aria-label')).toBe('出现 3 次')
  })

  it('should nest the pool group inside a collapsed details block', async () => {
    const wrapper = mountPanel({ words: WORDS })
    await wrapper.get('.used-toggle').trigger('click')

    const pool = wrapper.get('details.pool')
    expect(pool.attributes('open')).toBeUndefined()
    expect(pool.get('summary').text()).toBe('顺带复习的 2 个词')
    // 即使收起也在 DOM 里，展开时不额外请求
    expect(pool.text()).toContain('patient')
  })

  it('should drop blank words and still count the rest', async () => {
    const wrapper = mountPanel({
      words: [
        { word: '  ', count: 2, kind: 'focus' },
        { word: 'garden', count: 0, kind: 'target' },
      ],
    })

    expect(wrapper.get('.used-toggle').text()).toContain('本文用到了 1 个你的单词')
    await wrapper.get('.used-toggle').trigger('click')
    // count 缺失 / 0 时至少显示一次，不能出现 ×0
    expect(wrapper.get('.chip-count').text()).toBe('×1')
  })

  it('should keep chips non-interactive unless clickable is enabled', async () => {
    const wrapper = mountPanel({ words: WORDS })
    await wrapper.get('.used-toggle').trigger('click')

    expect(wrapper.find('button.chip').exists()).toBe(false)
    expect(wrapper.get('.chip.is-focus').attributes('aria-haspopup')).toBeUndefined()
  })
})

describe('UsedWordsPanel · clickable', () => {
  it('should turn chips into buttons and show the part of speech with Chinese', async () => {
    let resolveLookup = null
    lookupMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve
        }),
    )

    const wrapper = mountClickable()
    await wrapper.get('.used-toggle').trigger('click')

    const chip = wrapper.get('button.chip.is-focus')
    expect(chip.text()).toBe('courage')
    expect(chip.attributes('aria-label')).toBe('查看 courage 的词性与中文释义')
    expect(chip.attributes('aria-haspopup')).toBe('dialog')
    expect(chip.attributes('aria-expanded')).toBe('false')

    await chip.trigger('click')

    // 浮层先打开并显示加载态，查询完成后替换为释义
    expect(wrapper.get('.detail-status').text()).toBe('正在查询释义…')
    expect(chip.attributes('aria-expanded')).toBe('true')
    expect(chip.classes()).toContain('is-active')

    resolveLookup({
      word: 'courage',
      phonetic: { uk: '/ˈkʌr.ɪdʒ/', us: '/ˈkɝː.ɪdʒ/' },
      senses: [{ pos: 'n.', meaning: '勇气；胆量' }],
      facts: [{ label: '来源', value: '词库' }],
      state: 'ready',
      message: '',
    })
    await flushPromises()

    expect(lookupMock).toHaveBeenCalledWith('courage')
    expect(wrapper.findAll('.detail-sense')).toHaveLength(1)
    expect(wrapper.get('.sense-pos').text()).toBe('n.')
    expect(wrapper.get('.sense-meaning').text()).toBe('勇气；胆量')
    expect(wrapper.get('.detail-word').text()).toBe('courage')
  })

  it('should close on a second click and when the whole panel is collapsed', async () => {
    lookupMock.mockResolvedValue({
      word: 'courage',
      phonetic: null,
      senses: [{ pos: 'n.', meaning: '勇气' }],
      facts: [],
      state: 'ready',
      message: '',
    })

    const wrapper = mountClickable()
    await wrapper.get('.used-toggle').trigger('click')

    const chip = wrapper.get('button.chip.is-focus')
    await chip.trigger('click')
    await flushPromises()
    expect(wrapper.find('.detail-popover').exists()).toBe(true)

    await chip.trigger('click')
    expect(wrapper.find('.detail-popover').exists()).toBe(false)

    await chip.trigger('click')
    await flushPromises()
    expect(wrapper.find('.detail-popover').exists()).toBe(true)

    // 收起清单会移除 chip，浮层必须一起关闭
    await wrapper.get('.used-toggle').trigger('click')
    expect(wrapper.find('.detail-popover').exists()).toBe(false)
  })

  it('should close the popover when the pool details block is collapsed', async () => {
    lookupMock.mockResolvedValue({
      word: 'patient',
      phonetic: null,
      senses: [{ pos: 'adj.', meaning: '有耐心的' }],
      facts: [],
      state: 'ready',
      message: '',
    })

    const wrapper = mountClickable()
    await wrapper.get('.used-toggle').trigger('click')

    const details = wrapper.get('details.pool')
    details.element.open = true
    await details.trigger('toggle')

    const chip = wrapper.get('button.chip.is-pool')
    await chip.trigger('click')
    await flushPromises()
    expect(wrapper.find('.detail-popover').exists()).toBe(true)

    details.element.open = false
    await details.trigger('toggle')
    expect(wrapper.find('.detail-popover').exists()).toBe(false)
  })

  it('should show an explicit empty state when the word cannot be found', async () => {
    lookupMock.mockResolvedValue({
      word: 'mystery',
      phonetic: null,
      senses: [],
      facts: [],
      state: 'empty',
      message: '没有查到这个词的释义，它可能已从词库删除，或不在词库中。',
    })

    const wrapper = mountClickable()
    await wrapper.get('.used-toggle').trigger('click')
    await wrapper.get('button.chip.is-pool').trigger('click')
    await flushPromises()

    expect(wrapper.get('.detail-status').text()).toContain('没有查到这个词的释义')
  })

  it('should show a retryable error state when the lookup fails', async () => {
    lookupMock.mockResolvedValue({
      word: 'courage',
      phonetic: null,
      senses: [],
      facts: [],
      state: 'error',
      message: '释义加载失败，再点一次可以重试。',
    })

    const wrapper = mountClickable()
    await wrapper.get('.used-toggle').trigger('click')
    await wrapper.get('button.chip.is-focus').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('释义加载失败，再点一次可以重试。')
  })
})
