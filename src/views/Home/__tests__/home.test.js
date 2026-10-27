/**
 * 首页入口分支测试
 * 覆盖未保存设置 → 跳设置页并提示、空词库 → 二次确认、正常 → 生成并进入答题页。
 * 词汇与生成接口在此替换为 mock，避免依赖 300ms 延迟与 seed 数据。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import Home from '../index.vue'
import { fetchWords } from '../../../api/words'
import { generateReading } from '../../../api/readings'
import { useReadingStore } from '../../../stores/model/reading'
import { useSettingsStore } from '../../../stores/model/settings'
import { useToastStore } from '../../../stores/model/toast'

vi.mock('../../../api/words', () => ({ fetchWords: vi.fn() }))
vi.mock('../../../api/readings', () => ({ generateReading: vi.fn() }))

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
  vi.clearAllMocks()
  fetchWords.mockResolvedValue(WORDS_RESPONSE)
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

  it('should generate and navigate to the reading page when ready', async () => {
    setActivePinia(createPinia())
    useSettingsStore().save({ level: 'easy', targetWords: 100, questionCount: 5 })
    generateReading.mockResolvedValue({
      id: 'r99',
      title: 'A Quiet Morning',
      article: 'It is a sunny day.',
      level: 'easy',
      targetWords: 100,
      questionCount: 5,
      questions: [],
    })

    const { wrapper, router } = await mountHome()
    await wrapper.get('button.entry').trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/readings/r99'), {
      timeout: 2000,
    })
    expect(useReadingStore().phase).toBe('answering')
  })
})
