/**
 * 练习结果页集成测试
 * 覆盖已提交结果的完整渲染、答错题解析、未提交重定向、404 与再练一次。
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import ResultPage from '../index.vue'
import { registerGuards } from '../../../router/guards'
import { resetMockDb, setMockLatency } from '../../../mock/adapter'
import { localStore, storageKeys } from '../../../unit/storage'

const { startMock } = vi.hoisted(() => ({ startMock: vi.fn() }))

vi.mock('../../../composables/useGenerateReading', async () => {
  const { ref } = await import('vue')
  return {
    useGenerateReading: () => ({ isGenerating: ref(false), start: startMock }),
  }
})

const ReadingStub = defineComponent({
  name: 'ReadingStub',
  template: '<div class="reading-stub">reading</div>',
})

const HistoryStub = defineComponent({
  name: 'HistoryStub',
  template: '<div class="history-stub">history</div>',
})

const HomeStub = defineComponent({
  name: 'HomeStub',
  template: '<div class="home-stub">home</div>',
})

const originalMatchMedia = window.matchMedia

function createTestRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: HomeStub },
      { path: '/readings/:id', name: 'reading', component: ReadingStub },
      { path: '/readings/:id/result', name: 'reading-result', component: ResultPage },
      { path: '/history', name: 'history', component: HistoryStub },
    ],
  })

  registerGuards(router)
  return router
}

async function mountResult(path) {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createTestRouter()
  await router.push(path)
  await router.isReady()
  await flushPromises()

  const wrapper = mount(ResultPage, {
    global: { plugins: [pinia, router] },
  })

  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  // 结果页是受保护路由：预置令牌，让用例只验证页面自身逻辑
  localStore.set(storageKeys.accessToken, 'sess_result_test')
  resetMockDb()
  setMockLatency(0)
  startMock.mockReset()

  // 成绩环直接显示终值，避免测试等待 900ms 动画
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})

afterAll(() => {
  window.matchMedia = originalMatchMedia
  setMockLatency(300)
})

describe('Result page', () => {
  it('should render the submitted result, review cards and translation', async () => {
    const { wrapper, router } = await mountResult('/readings/r2/result')

    expect(router.currentRoute.value.name).toBe('reading-result')
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.get('h1').text()).toBe('练习结果')
    expect(wrapper.text()).toContain('The Garden Gate')
    expect(wrapper.text()).toContain('答对 4 / 5')
    expect(wrapper.get('.ring').attributes('aria-label')).toBe('得分 4 / 5，正确率 80%')
    expect(wrapper.get('.ring-fraction').text()).toBe('4 / 5')
    expect(wrapper.get('.ring-percent').text()).toBe('80%')
    expect(wrapper.findAll('.review-card')).toHaveLength(5)
    expect(wrapper.text()).toContain('每天下午，汤姆都会走到那座旧花园的门前。')

    // 结果页同样带词数、生词面板与本次生成的 token 数
    expect(wrapper.get('.article-meta').text()).toMatch(/^\d+ 词$/)
    expect(wrapper.text()).toContain('本文含 2 个未学单词')
    expect(wrapper.get('.result-time').text()).toContain('本次生成消耗 904 tokens')

    // 生词面板没绑 v-model 也要能展开：点标题后清单出现
    await wrapper.get('.new-words-toggle').trigger('click')
    expect(wrapper.findAll('.new-word')).toHaveLength(2)
    expect(wrapper.get('.new-words-toggle').attributes('aria-expanded')).toBe('true')

    await wrapper.get('.new-words-toggle').trigger('click')
    expect(wrapper.findAll('.new-word')).toHaveLength(0)

    const wrongCard = wrapper.findAll('.review-card')[3]
    expect(wrongCard.classes()).toContain('is-wrong')
    expect(wrongCard.text()).toContain('回答错误')
    expect(wrongCard.text()).toContain('D. A neighbor')
    expect(wrongCard.text()).toContain('B. A friend')
    expect(wrongCard.text()).toContain('Sometimes a friend joins him')
  })

  it('should redirect an unsubmitted result to the answering page', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const router = createTestRouter()
    await router.push('/readings/r5/result')
    await router.isReady()
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('reading')
    expect(router.currentRoute.value.params.id).toBe('r5')
  })

  it('should show a not-found card and return to history', async () => {
    const { wrapper, router } = await mountResult('/readings/r404/result')

    expect(wrapper.get('.state-card').attributes('role')).toBe('alert')
    expect(wrapper.text()).toContain('这篇练习不存在或已被删除')
    // 错误态也必须有唯一 h1，否则读屏无法判断页面主题
    expect(wrapper.findAll('h1')).toHaveLength(1)

    const back = wrapper.findAll('button').find((button) => button.text().includes('返回历史'))
    await back.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('history')
  })

  it('should regenerate with the same parameters and open the new reading', async () => {
    startMock.mockResolvedValue({ id: 'r6' })

    const { wrapper, router } = await mountResult('/readings/r2/result')
    const retry = wrapper.findAll('button').find((button) => button.text().includes('再练一次'))

    await retry.trigger('click')
    await flushPromises()

    expect(startMock).toHaveBeenCalledWith({
      level: 'easy',
      targetWords: 100,
      questionCount: 5,
    })
    expect(router.currentRoute.value.path).toBe('/readings/r6')
  })
})
