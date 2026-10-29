/**
 * 自选单词组件
 * 只列「学习中 / 已掌握」；选满后禁用其余；失效词标红；空选择不发 focusWords。
 * 弹窗内容被 Teleport 到 body，所以断言走 document.body，而不是 wrapper.find。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import FocusWordsPicker from '../component/FocusWordsPicker.vue'
import { fetchWords } from '../../../api/words'

vi.mock('../../../api/words', () => ({ fetchWords: vi.fn() }))

const LEARNING_PAGE = {
  items: [
    { id: 'w1', word: 'tired', status: 'learning', summary: 'adj. 疲倦的' },
    { id: 'w2', word: 'garden', status: 'learning', summary: 'n. 花园' },
  ],
  total: 2,
  page: 1,
  pageSize: 10,
  counts: { all: 2, learning: 2, mastered: 0, new: 0 },
}

function mountPicker(props = {}) {
  return mount(FocusWordsPicker, {
    props: { modelValue: [], limit: 10, ...props },
    attachTo: document.body,
  })
}

function q(selector) {
  return document.body.querySelector(selector)
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  fetchWords.mockResolvedValue(LEARNING_PAGE)
})

describe('focus words picker', () => {
  it('should ask a guest to log in instead of loading the library', async () => {
    const wrapper = mountPicker({ enabled: false })
    const button = wrapper.get('button').element

    expect(button.disabled).toBe(true)
    expect(wrapper.text()).toContain('登录后可以从自己的词库指定')

    button.click()
    await flushPromises()

    expect(fetchWords).not.toHaveBeenCalled()
  })

  it('should load learning words only when the dialog opens', async () => {
    const wrapper = mountPicker()

    expect(fetchWords).not.toHaveBeenCalled()

    q('.focus-actions button').click()
    await flushPromises()

    expect(fetchWords).toHaveBeenCalledWith({
      q: '',
      status: 'learning',
      page: 1,
      pageSize: 10,
    })
    expect(q('.picker-list').textContent).toContain('tired')
  })

  it('should emit the chosen word and keep the original case', async () => {
    const wrapper = mountPicker()

    q('.focus-actions button').click()
    await flushPromises()

    const items = [...document.body.querySelectorAll('.picker-item')]
    items[0].click()
    await flushPromises()

    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([['tired']])
  })

  it('should block new picks once the limit is reached', async () => {
    const wrapper = mountPicker({ modelValue: ['tired'], limit: 1 })

    q('.focus-actions button').click()
    await flushPromises()

    const items = [...document.body.querySelectorAll('.picker-item')]
    const selected = items.find((item) => item.getAttribute('aria-checked') === 'true')
    const other = items.find((item) => item.getAttribute('aria-checked') === 'false')

    expect(other.disabled).toBe(true)
    expect(wrapper.text()).toContain('已选满')

    // 已选的仍然可以取消，否则选满后就没法改
    selected.click()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([[]])
  })

  it('should remove a chip without opening the dialog', async () => {
    const wrapper = mountPicker({ modelValue: ['tired', 'garden'] })

    document.body.querySelector('[aria-label="移除 garden"]').click()
    await flushPromises()

    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([['tired']])
  })

  it('should mark words that the capacity check reported as invalid', async () => {
    const wrapper = mountPicker({ modelValue: ['Tired', 'courage'], invalid: ['courage'] })

    expect(q('.chip.is-invalid').textContent).toContain('courage')
    expect(wrapper.text()).toContain('有 1 个词不在词库或已标记为「不认识」')
  })

  it('should search with a debounce and reset to the first page', async () => {
    const wrapper = mountPicker({ modelValue: [], limit: 10 })

    q('.focus-actions button').click()
    await flushPromises()
    fetchWords.mockClear()

    const input = q('.picker-search input')
    input.value = 'gar'
    input.dispatchEvent(new Event('input'))
    await new Promise((resolve) => setTimeout(resolve, 320))
    await flushPromises()

    expect(fetchWords).toHaveBeenCalledWith({
      q: 'gar',
      status: 'learning',
      page: 1,
      pageSize: 10,
    })
  })

  it('should show an empty state when the status has no words', async () => {
    fetchWords.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10, counts: {} })
    mountPicker()

    q('.focus-actions button').click()
    await flushPromises()

    expect(document.body.textContent).toContain('这个状态还没有单词')
  })
})
