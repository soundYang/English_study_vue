/**
 * 基础词库页面测试
 * 本页没有 mock 适配器，api 层用 vi.mock 替身。
 * 覆盖数字卡、分组标签、首屏请求参数、分组/状态/每页切换、搜索、空态与错误态。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BasicWordsView from '../index.vue'
import { fetchBasicWords } from '../../../api/basic-words'

vi.mock('../../../api/basic-words', () => ({
  fetchBasicWords: vi.fn(),
  removeBasicWord: vi.fn(),
  restoreBasicWord: vi.fn(),
}))

const COUNTS = {
  all: 650,
  basic: 600,
  calendar: 19,
  abbreviation: 32,
  removable: 421,
  functionWord: 179,
  learned: 0,
  removed: 32,
  untouched: 618,
}

function makeItem(overrides = {}) {
  return {
    word: 'abandon',
    kinds: ['basic'],
    kind: 'basic',
    isFunctionWord: false,
    removable: true,
    removed: false,
    personalStatus: null,
    wordId: null,
    cocaRank: 2201,
    phonetic: { uk: '/əˈbæn.dən/', us: '/əˈbæn.dən/' },
    senses: [{ pos: 'v.', meaning: '放弃；抛弃' }],
    summary: '放弃；抛弃',
    expansion: null,
    expansionMeaning: null,
    calendarType: null,
    ...overrides,
  }
}

function makePage(overrides = {}) {
  return {
    items: [makeItem(), makeItem({ word: 'ability', summary: '能力；才能' })],
    total: 600,
    page: 1,
    pageSize: 100,
    counts: { ...COUNTS },
    ...overrides,
  }
}

async function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(BasicWordsView, {
    global: {
      plugins: [pinia],
      stubs: { teleport: true },
    },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.resetAllMocks()
  fetchBasicWords.mockResolvedValue(makePage())
})

describe('Basic words page · 首屏', () => {
  it('should request the basic group with 100 per page on mount', async () => {
    await mountPage()

    expect(fetchBasicWords).toHaveBeenCalledWith({
      q: '',
      group: 'basic',
      status: 'all',
      page: 1,
      pageSize: 100,
    })
  })

  it('should render the four counters and the three group tabs', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()

    expect(text).toContain('词表总量')
    expect(text).toContain('650')
    expect(text).toContain('可标记实词')
    expect(text).toContain('421')
    expect(text).toContain('已标记不认识')
    expect(text).toContain('32')
    expect(text).toContain('功能词')
    expect(text).toContain('179')

    expect(wrapper.findAll('[role="radio"]')).toHaveLength(3)
    expect(text).toContain('基础词')
    expect(text).toContain('日历词')
    expect(text).toContain('缩写')
  })

  it('should render the cards and the footer summary', async () => {
    const wrapper = await mountPage()

    expect(wrapper.findAll('.word-card')).toHaveLength(2)
    expect(wrapper.text()).toContain('abandon')
    expect(wrapper.text()).toContain('放弃；抛弃')
    expect(wrapper.text()).toContain('共 600 条')
    expect(wrapper.text()).toContain('当前第 1 / 6 页')
  })
})

describe('Basic words page · 筛选', () => {
  it('should switch the group and go back to the first page', async () => {
    const wrapper = await mountPage()

    const calendarTab = wrapper
      .findAll('[role="radio"]')
      .find((tab) => tab.text().includes('日历词'))
    await calendarTab.trigger('click')
    await flushPromises()

    expect(fetchBasicWords).toHaveBeenLastCalledWith(
      expect.objectContaining({ group: 'calendar', page: 1 }),
    )
  })

  it('should search on Enter and reset the page', async () => {
    const wrapper = await mountPage()
    const input = wrapper.get('input[type="search"]')

    await input.setValue('医生')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(fetchBasicWords).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: '医生', page: 1 }),
    )
  })

  it('should switch the page size', async () => {
    const wrapper = await mountPage()

    const pageSizeTrigger = wrapper
      .findAll('.dropdown-trigger')
      .find((button) => button.text().includes('每页 100 条'))
    await pageSizeTrigger.trigger('click')
    await flushPromises()

    const fifty = wrapper.findAll('[role="option"]').find((option) => option.text().includes('50'))
    await fifty.trigger('click')
    await flushPromises()

    expect(fetchBasicWords).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageSize: 50, page: 1 }),
    )
  })
})

describe('Basic words page · 空态与错误', () => {
  it('should show the empty state when the group has no words', async () => {
    fetchBasicWords.mockResolvedValue(makePage({ items: [], total: 0 }))
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('这个分组暂时没有单词')
    expect(wrapper.findAll('.word-card')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('共 0 条')
  })

  it('should show the error card and retry', async () => {
    fetchBasicWords.mockRejectedValueOnce(new Error('boom'))
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('词表加载失败')

    fetchBasicWords.mockResolvedValue(makePage())
    await wrapper.get('.state-card button').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.word-card')).toHaveLength(2)
  })
})
