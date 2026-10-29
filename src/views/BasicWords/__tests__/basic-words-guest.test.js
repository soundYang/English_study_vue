/**
 * 基础词汇库 · 游客态测试
 * 锁住 md/45 §5.3：词表走公开接口、个人状态与写操作不渲染、筛选收窄。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BasicWordsView from '../index.vue'
import { fetchBasicWords, fetchPublicBasicWords } from '../../../api/basic-words'

vi.mock('../../../api/basic-words', () => ({
  fetchBasicWords: vi.fn(),
  fetchPublicBasicWords: vi.fn(),
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
  removed: 0,
  untouched: 650,
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

const PAGE = {
  items: [makeItem(), makeItem({ word: 'ability', summary: '能力；才能' })],
  total: 2,
  page: 1,
  pageSize: 100,
  counts: { ...COUNTS },
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

beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
  fetchPublicBasicWords.mockResolvedValue(PAGE)
  fetchBasicWords.mockResolvedValue(PAGE)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('Basic words page · guest', () => {
  it('should request the public endpoint instead of the personal one', async () => {
    await mountPage()

    expect(fetchPublicBasicWords).toHaveBeenCalledWith({
      q: '',
      group: 'basic',
      status: 'all',
      page: 1,
      pageSize: 100,
    })
    expect(fetchBasicWords).not.toHaveBeenCalled()
  })

  it('should render the real words without personal status or actions', async () => {
    await mountPage()

    expect(wrapper.text()).toContain('abandon')
    expect(wrapper.text()).toContain('放弃；抛弃')
    expect(wrapper.findAll('.status-pill')).toHaveLength(0)
    expect(wrapper.findAll('.card-menu')).toHaveLength(0)
    expect(wrapper.text()).toContain('登录后可标记认识程度')
  })

  it('should mask the personal removed counter and narrow the status filter', async () => {
    await mountPage()

    // 「已标记不认识」是个人数据，公开接口给的 0 不能当真数字展示
    expect(wrapper.find('.stats-grid .guest-mask.is-number').exists()).toBe(true)

    const statusFilter = wrapper.findAll('.filters .dropdown')[0]
    await statusFilter.get('button').trigger('click')
    const options = statusFilter.findAll('[role="option"]').map((item) => item.text())

    expect(options).toEqual(['全部状态', '未标记'])
  })
})
