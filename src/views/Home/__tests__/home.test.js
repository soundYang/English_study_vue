/**
 * 首页入口分支测试
 * 覆盖未保存设置 → 跳设置页并提示、空词库 → 二次确认、正常 → 交接到生成页。
 * 词汇与预检接口在此替换为 mock，避免依赖 300ms 延迟与 seed 数据。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import Home from '../index.vue'
import { fetchStudyStats, fetchWords } from '../../../api/words'
import { fetchCapacity, generateReading } from '../../../api/readings'
import { fetchQuota } from '../../../api/quota'
import { fetchApiKey } from '../../../api/profile'
import {
  clearGenerationHandoff,
  takeGenerationHandoff,
} from '../../../composables/useGenerationHandoff'
import { useSettingsStore } from '../../../stores/model/settings'
import { useToastStore } from '../../../stores/model/toast'
import { localStore, storageKeys } from '../../../unit/storage'

vi.mock('../../../api/words', () => ({ fetchWords: vi.fn(), fetchStudyStats: vi.fn() }))
vi.mock('../../../api/readings', () => ({
  fetchCapacity: vi.fn(),
  generateReading: vi.fn(),
}))
vi.mock('../../../api/quota', () => ({ fetchQuota: vi.fn() }))
// useQuota 会先确认有没有自备 Key；这里固定为没有，额度成为唯一判据
vi.mock('../../../api/profile', () => ({ fetchApiKey: vi.fn() }))

const WORDS_RESPONSE = {
  total: 24,
  counts: { all: 24, mastered: 11, learning: 9, new: 4 },
}

const EMPTY_RESPONSE = {
  total: 0,
  counts: { all: 0, mastered: 0, learning: 0, new: 0 },
}

const QUOTA_ALLOWED = {
  day: '2026-10-29',
  resetAt: '2026-10-29T16:00:00.000Z',
  primary: { scope: 'device', limit: 3, used: 1, remaining: 2 },
  blocking: null,
  breakdown: [],
}

const QUOTA_BLOCKED = {
  ...QUOTA_ALLOWED,
  primary: { scope: 'device', limit: 3, used: 1, remaining: 2 },
  blocking: { scope: 'network', limit: 10, used: 10, remaining: 0 },
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/settings', name: 'settings', component: { template: '<div />' } },
      { path: '/words', name: 'words', component: { template: '<div />' } },
      { path: '/generating', name: 'generating', component: { template: '<div />' } },
      { path: '/readings/:id', name: 'reading', component: { template: '<div />' } },
      { path: '/profile', name: 'profile', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' } },
    ],
  })
}

async function mountHome({ authenticated = true } = {}) {
  if (authenticated) localStore.set(storageKeys.accessToken, 'sess_home_test')

  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createTestRouter()
  router.push('/')
  await router.isReady()

  const wrapper = mount(Home, {
    global: { plugins: [pinia, router], stubs: { teleport: true } },
  })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  localStorage.clear()
  clearGenerationHandoff()
  vi.clearAllMocks()
  fetchWords.mockResolvedValue(WORDS_RESPONSE)
  // 默认没有到期词：红点只在有积压时出现
  fetchStudyStats.mockResolvedValue({ pendingReview: 0 })
  // 首页只用预检的 available 覆盖词表口径的数字，其余字段不消费
  fetchCapacity.mockResolvedValue({ available: 20 })
  fetchQuota.mockResolvedValue(QUOTA_ALLOWED)
  fetchApiKey.mockResolvedValue({ enabled: true, supportedProviders: ['deepseek'], key: null })
})

describe('home entry branches', () => {
  it('should keep guests on the public page without calling personal apis', async () => {
    const { wrapper, router } = await mountHome({ authenticated: false })

    // 游客不请求词库 / 预检 / 额度 / 自备 Key
    expect(fetchWords).not.toHaveBeenCalled()
    expect(fetchCapacity).not.toHaveBeenCalled()
    expect(fetchQuota).not.toHaveBeenCalled()
    expect(fetchApiKey).not.toHaveBeenCalled()
    expect(fetchStudyStats).not.toHaveBeenCalled()

    expect(wrapper.text()).toContain('登录后查看你的词库')
    expect(wrapper.text()).toContain('登录后即可生成专属阅读')

    await wrapper.get('button.entry').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/login?redirect=/settings')
    expect(takeGenerationHandoff()).toBeNull()
  })

  it('should send users to settings when no settings were saved', async () => {
    const { wrapper, router } = await mountHome()

    await wrapper.get('button.entry').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/settings')
    expect(useToastStore().items.map((item) => item.message)).toContain(
      '先完成阅读设置，再开始生成',
    )
  })

  it('should ask before generating when the vocabulary library is empty', async () => {
    setActivePinia(createPinia())
    useSettingsStore().save({ level: 'easy', targetWords: 100, questionCount: 5 })
    fetchWords.mockResolvedValue(EMPTY_RESPONSE)

    const { wrapper, router } = await mountHome()
    await wrapper.get('button.entry').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/')
    expect(wrapper.text()).toContain('词汇库还是空的')
    expect(generateReading).not.toHaveBeenCalled()
  })

  it('should hand the generation over to the generating page', async () => {
    setActivePinia(createPinia())
    useSettingsStore().save({ level: 'easy', targetWords: 100, questionCount: 5 })

    const { wrapper, router } = await mountHome()

    expect(wrapper.get('button.entry').text()).toContain('今日剩余 2 次')

    await wrapper.get('button.entry').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/generating')
    // 请求改在生成页发，首页只交参数与词库口径
    expect(generateReading).not.toHaveBeenCalled()
    expect(takeGenerationHandoff()).toEqual({
      payload: { level: 'easy', targetWords: 100, questionCount: 5, vocabScope: ['all'] },
      availableWords: 20,
      from: '/',
    })
  })

  it('should disable the start card when any quota dimension is used up', async () => {
    setActivePinia(createPinia())
    useSettingsStore().save({ level: 'easy', targetWords: 100, questionCount: 5 })
    fetchQuota.mockResolvedValue(QUOTA_BLOCKED)

    const { wrapper, router } = await mountHome()
    const card = wrapper.get('button.entry')

    expect(card.attributes('disabled')).toBeDefined()
    expect(card.classes()).toContain('is-disabled')
    // 卡内只留结论，完整说明在卡组上方；网络桶用尽、设备桶还有次数必须说清是哪一档
    expect(card.text()).toContain('今天的免费次数用完了')
    const notice = wrapper.get('.home-quota')
    expect(notice.text()).toContain('网络每天最多免费生成 10 次')
    expect(notice.text()).toContain('接入自己的 API Key')
    // 跳转方式：个人中心的 API 设置卡
    expect(notice.get('a').attributes('href')).toBe('/profile#api-settings')

    await card.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/')
    expect(takeGenerationHandoff()).toBeNull()
  })
})

describe('home review dot', () => {
  it('should put a dot on the words entry when something is due', async () => {
    fetchStudyStats.mockResolvedValue({ pendingReview: 3 })

    const { wrapper } = await mountHome()
    const wordsEntry = wrapper.findAll('.entry')[0]

    expect(wordsEntry.find('.entry-dot').exists()).toBe(true)
    // 红点纯装饰，读屏靠这行隐藏文案
    expect(wordsEntry.text()).toContain('有 3 个单词待复习')

    wrapper.unmount()
  })

  it('should hide the dot when nothing is due', async () => {
    const { wrapper } = await mountHome()

    expect(wrapper.find('.entry-dot').exists()).toBe(false)
    expect(wrapper.text()).toContain('已收录 24 个单词')

    wrapper.unmount()
  })

  it('should keep the page usable when the stats request fails', async () => {
    fetchStudyStats.mockRejectedValueOnce(new Error('stats offline'))

    const { wrapper } = await mountHome()

    expect(wrapper.find('.entry-dot').exists()).toBe(false)
    expect(wrapper.text()).toContain('已收录 24 个单词')

    wrapper.unmount()
  })
})
