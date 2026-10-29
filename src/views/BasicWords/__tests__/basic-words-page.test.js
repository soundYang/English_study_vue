/**
 * 基础词库页面测试
 * 本页没有 mock 适配器，api 层用 vi.mock 替身。
 * 覆盖数字卡、分组标签、首屏请求参数、分组/状态/每页切换、搜索、空态与错误态。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BasicWordsView from '../index.vue'
import { fetchBasicWords, setBasicWordMark } from '../../../api/basic-words'
import { useToastStore } from '../../../stores/model/toast'
import { localStore, storageKeys } from '../../../unit/storage'

vi.mock('../../../api/basic-words', () => ({
  fetchBasicWords: vi.fn(),
  fetchPublicBasicWords: vi.fn(),
  setBasicWordMark: vi.fn(),
}))

const COUNTS = {
  all: 650,
  basic: 600,
  calendar: 19,
  abbreviation: 32,
  removable: 421,
  functionWord: 179,
  known: 12,
  learned: 0,
  removed: 32,
  untouched: 606,
}

function makeItem(overrides = {}) {
  return {
    word: 'abandon',
    kinds: ['basic'],
    kind: 'basic',
    isFunctionWord: false,
    removable: true,
    personalState: 'untouched',
    knownSource: null,
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

let wrapper = null

async function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(BasicWordsView, {
    attachTo: document.body,
    global: {
      plugins: [pinia],
      stubs: { teleport: true },
    },
  })
  await flushPromises()
  return wrapper
}

// 详情浮层要靠 isConnected 判断锚点还在不在，所以页面必须挂到真实文档上
afterEach(() => {
  if (wrapper) wrapper.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

beforeEach(() => {
  vi.resetAllMocks()
  // 本文件测登录后的个人状态与写操作；游客只读另有独立用例（md/45 §5.3）
  localStore.set(storageKeys.accessToken, 'sess_basic_words_page')
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

describe('Basic words page · 详情浮层', () => {
  it('should open the word detail and close it on the second click', async () => {
    const wrapper = await mountPage()
    const trigger = wrapper.findAll('.card-word-button')[0]

    await trigger.trigger('click')
    await flushPromises()

    const panel = wrapper.get('.detail-popover')
    expect(panel.text()).toContain('放弃；抛弃')
    expect(panel.text()).toContain('词表')
    expect(panel.get('.detail-word').text()).toBe('abandon')
    expect(trigger.attributes('aria-expanded')).toBe('true')

    await trigger.trigger('click')
    await flushPromises()

    expect(wrapper.find('.detail-popover').exists()).toBe(false)
    expect(trigger.attributes('aria-expanded')).toBe('false')
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

describe('Basic words page · 三态标记', () => {
  async function chooseAction(wrapper, label) {
    await wrapper.get('.menu-trigger').trigger('click')
    await flushPromises()

    const action = wrapper.findAll('[role="menuitem"]').find((node) => node.text() === label)
    await action.trigger('click')
    await flushPromises()
  }

  it('should confirm before marking a word as unknown', async () => {
    setBasicWordMark.mockResolvedValue({
      item: makeItem({ personalState: 'removed' }),
      counts: COUNTS,
    })
    const wrapper = await mountPage()

    await chooseAction(wrapper, '标为不认识')

    expect(wrapper.get('.modal-title').text()).toBe('标记 “abandon” 为不认识？')
    expect(setBasicWordMark).not.toHaveBeenCalled()

    const confirm = wrapper.findAll('.modal-footer button').at(-1)
    expect(confirm.text()).toBe('标记不认识')

    await confirm.trigger('click')
    await flushPromises()

    expect(setBasicWordMark).toHaveBeenCalledWith('abandon', 'unknown')
    // 写成功后静默对账一次，拿到新的数字与列表
    expect(fetchBasicWords).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.modal-dialog').exists()).toBe(false)
  })

  it('should not mark anything when the dialog is cancelled', async () => {
    const wrapper = await mountPage()

    await chooseAction(wrapper, '标为不认识')

    const cancel = wrapper.findAll('.modal-footer button').at(0)
    await cancel.trigger('click')
    await flushPromises()

    expect(setBasicWordMark).not.toHaveBeenCalled()
    expect(wrapper.find('.modal-dialog').exists()).toBe(false)
  })

  it('should mark a word as known without asking', async () => {
    setBasicWordMark.mockResolvedValue({
      item: makeItem({ personalState: 'known', knownSource: 'mark' }),
      counts: COUNTS,
    })
    const wrapper = await mountPage()

    await chooseAction(wrapper, '标为认识')

    expect(wrapper.find('.modal-dialog').exists()).toBe(false)
    expect(setBasicWordMark).toHaveBeenCalledWith('abandon', 'known')
    expect(useToastStore().items.at(-1)).toMatchObject({
      type: 'success',
      message: '已标记 “abandon” 为认识',
    })
  })

  it('should clear the mark of a removed word without asking', async () => {
    fetchBasicWords.mockResolvedValue(
      makePage({ items: [makeItem({ word: 'ai', personalState: 'removed' })] }),
    )
    setBasicWordMark.mockResolvedValue({ item: makeItem({ word: 'ai' }), counts: COUNTS })
    const wrapper = await mountPage()

    await chooseAction(wrapper, '取消标记')

    expect(wrapper.find('.modal-dialog').exists()).toBe(false)
    expect(setBasicWordMark).toHaveBeenCalledWith('ai', 'none')
    expect(useToastStore().items.at(-1)).toMatchObject({
      type: 'success',
      message: '已取消 “ai” 的标记',
    })
  })

  it('should offer the library explanation instead of actions for a word in my list', async () => {
    fetchBasicWords.mockResolvedValue(
      makePage({
        items: [
          makeItem({
            word: 'abandon',
            personalState: 'known',
            knownSource: 'library',
            wordId: 'w1',
          }),
        ],
      }),
    )
    const wrapper = await mountPage()

    await wrapper.get('.menu-trigger').trigger('click')
    await flushPromises()

    const items = wrapper.findAll('[role="menuitem"]')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toContain('已在词库中')
    expect(items[0].attributes('disabled')).toBeDefined()
  })

  it('should surface the backend message when marking fails', async () => {
    const message = '这个单词已经在你的词库里了'
    setBasicWordMark.mockRejectedValue({
      response: { status: 409, data: { error: { code: 'BASIC_WORD_ALREADY_LEARNED', message } } },
    })
    const wrapper = await mountPage()

    await chooseAction(wrapper, '标为不认识')
    await wrapper.findAll('.modal-footer button').at(-1).trigger('click')
    await flushPromises()

    // 失败也关掉对话框，错误交给 toast；列表回到服务端的样子
    expect(wrapper.find('.modal-dialog').exists()).toBe(false)
    expect(useToastStore().items.at(-1)).toMatchObject({ type: 'error', message })
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
