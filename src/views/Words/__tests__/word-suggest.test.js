/**
 * 词库联想测试
 * 覆盖触发条件（长度、防抖、开关）、选中后的锁定态与提交 payload。
 * 词库接口整体替换为 mock，只验证表单侧行为。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import WordFormPanel from '../component/WordFormPanel.vue'
import { searchDictionary } from '../../../api/dictionary'

vi.mock('../../../api/dictionary', () => ({
  searchDictionary: vi.fn(),
}))

const ENTRY = {
  id: 'dict_abandon',
  headword: 'abandon',
  phonetic: { uk: '/əˈbæn.dən/', us: '/əˈbæn.dən/' },
  senses: [
    { pos: 'v.', meaning: '放弃；抛弃' },
    { pos: 'n.', meaning: '放任；放纵' },
  ],
  source: 'mock',
}

const SECOND_ENTRY = {
  id: 'dict_abandoned',
  headword: 'abandoned',
  phonetic: { uk: '/əˈbæn.dənd/', us: '/əˈbæn.dənd/' },
  senses: [{ pos: 'adj.', meaning: '被遗弃的' }],
  source: 'mock',
}

describe('WordFormPanel · 词库联想', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    localStorage.clear()
    searchDictionary.mockResolvedValue({ query: 'aban', items: [ENTRY] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not search until two characters are typed', async () => {
    const wrapper = mount(WordFormPanel, { props: { submitWord: vi.fn() } })

    await wrapper.findAll('input')[0].setValue('a')
    vi.advanceTimersByTime(400)
    await flushPromises()

    expect(searchDictionary).not.toHaveBeenCalled()
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('should show suggestions after the debounce delay', async () => {
    const wrapper = mount(WordFormPanel, { props: { submitWord: vi.fn() } })

    await wrapper.findAll('input')[0].setValue('aban')
    vi.advanceTimersByTime(299)
    await flushPromises()
    expect(searchDictionary).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    await flushPromises()

    expect(searchDictionary).toHaveBeenCalledWith('aban', expect.anything())
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('放弃；抛弃')

    wrapper.unmount()
  })

  it('should lock the entry and submit the dictionary snapshot', async () => {
    const submitWord = vi.fn().mockResolvedValue({ ok: true })
    const wrapper = mount(WordFormPanel, { props: { submitWord } })

    await wrapper.findAll('input')[0].setValue('aban')
    vi.advanceTimersByTime(300)
    await flushPromises()

    await wrapper.get('[role="option"]').trigger('click')
    await flushPromises()

    // 锁定后：只剩单词框，释义输入框被只读卡片替换
    expect(wrapper.findAll('input')).toHaveLength(1)
    expect(wrapper.text()).toContain('放任；放纵')
    expect(wrapper.text()).toContain('换个词')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(submitWord).toHaveBeenCalledWith({
      word: 'abandon',
      status: 'learning',
      source: 'dictionary',
      dictionaryId: 'dict_abandon',
      phonetic: ENTRY.phonetic,
      senses: ENTRY.senses,
    })

    wrapper.unmount()
  })

  it('should render only the latest response when typing quickly', async () => {
    let resolveFirst
    const first = new Promise((resolve) => {
      resolveFirst = resolve
    })
    searchDictionary
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ query: 'aband', items: [SECOND_ENTRY] })

    const wrapper = mount(WordFormPanel, { props: { submitWord: vi.fn() } })
    const input = wrapper.findAll('input')[0]

    await input.setValue('aban')
    vi.advanceTimersByTime(300)
    await flushPromises()

    await input.setValue('aband')
    vi.advanceTimersByTime(300)
    await flushPromises()

    // 先发出的请求晚到，不能覆盖后一次的结果
    resolveFirst({ query: 'aban', items: [ENTRY] })
    await flushPromises()

    expect(wrapper.text()).toContain('被遗弃的')
    expect(wrapper.text()).not.toContain('放任；放纵')

    wrapper.unmount()
  })

  it('should show the empty note when the dictionary has no match', async () => {
    searchDictionary.mockResolvedValue({ query: 'zzzz', items: [] })

    const wrapper = mount(WordFormPanel, { props: { submitWord: vi.fn() } })

    await wrapper.findAll('input')[0].setValue('zzzz')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.text()).toContain('词库未收录')

    wrapper.unmount()
  })

  it('should fall back to manual input when the dictionary request fails', async () => {
    searchDictionary.mockRejectedValue(new Error('503 Service Unavailable'))

    const wrapper = mount(WordFormPanel, { props: { submitWord: vi.fn() } })

    await wrapper.findAll('input')[0].setValue('aban')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.text()).toContain('词库暂时不可用')

    wrapper.unmount()
  })

  it('should not search when the autocomplete toggle is off', async () => {
    const wrapper = mount(WordFormPanel, { props: { submitWord: vi.fn() } })

    const offButton = wrapper.findAll('button').find((button) => button.text() === '关')
    await offButton.trigger('click')

    await wrapper.findAll('input')[0].setValue('aban')
    vi.advanceTimersByTime(400)
    await flushPromises()

    expect(searchDictionary).not.toHaveBeenCalled()
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)

    wrapper.unmount()
  })
})
