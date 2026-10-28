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
import { fetchWords } from '../../../api/words'
import { fetchCapacity, generateReading } from '../../../api/readings'
import {
  clearGenerationHandoff,
  takeGenerationHandoff,
} from '../../../composables/useGenerationHandoff'
import { useSettingsStore } from '../../../stores/model/settings'
import { useToastStore } from '../../../stores/model/toast'

vi.mock('../../../api/words', () => ({ fetchWords: vi.fn() }))
vi.mock('../../../api/readings', () => ({
  fetchCapacity: vi.fn(),
  generateReading: vi.fn(),
}))

const WORDS_RESPONSE = {
  total: 24,
  counts: { all: 24, mastered: 11, learning: 9, new: 4 },
}

const EMPTY_RESPONSE = {
  total: 0,
  counts: { all: 0, mastered: 0, learning: 0, new: 0 },
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
    ],
  })
}

async function mountHome() {
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
  // 首页只用预检的 available 覆盖词表口径的数字，其余字段不消费
  fetchCapacity.mockResolvedValue({ available: 20 })
})

describe('home entry branches', () => {
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
})
