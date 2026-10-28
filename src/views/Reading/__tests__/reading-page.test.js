/**
 * 阅读答题页面测试
 * 覆盖安全 DTO 渲染、选择持久化、未答提交确认、结果页跳转、退出确认与 404 状态；
 * 使用真实 mock adapter（延迟 0），路由以最小桩替换。
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ReadingView from '../index.vue'
import { resetMockDb, setMockLatency } from '../../../mock/adapter'
import { useReadingStore } from '../../../stores/model/reading'

const routeState = vi.hoisted(() => ({ id: 'r5' }))
const routerMocks = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: routeState.id } }),
  useRouter: () => routerMocks,
}))

let wrapper = null

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetMockDb()
  setMockLatency(0)
  routeState.id = 'r5'
  routerMocks.replace.mockReset()
  routerMocks.push.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

afterAll(() => {
  setMockLatency(300)
})

async function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(ReadingView, {
    global: {
      plugins: [pinia],
      stubs: { teleport: true },
    },
  })
  await flushPromises()
  return wrapper
}

function findButton(target, label) {
  return target.findAll('button').find((button) => button.text().trim() === label)
}

describe('Reading page', () => {
  it('should render the article and questions without answers or translation', async () => {
    const page = await mountPage()
    const store = useReadingStore()

    expect(page.get('h1').text()).toBe('The Courage to Begin')
    expect(page.findAll('.question-card')).toHaveLength(5)
    expect(page.text()).toContain('阅读理解（共 5 题）')
    expect(page.text()).toContain('已答 0 / 5')

    expect(store.phase).toBe('answering')
    expect(store.reading.translation).toBeUndefined()
    expect(page.text()).not.toContain('人们谈起勇气')
    expect(page.html()).not.toContain('correctAnswer')
    expect(page.html()).not.toContain('explanation')
  })

  it('should show the actual word count and the new-words panel', async () => {
    const page = await mountPage()
    const store = useReadingStore()

    // 词数以 DTO 给的 actualWords 为准，不在视图里重新数一遍
    expect(page.get('.article-meta').text()).toBe(`${store.reading.actualWords} 词`)
    expect(page.text()).toContain('本文含 2 个未学单词')
    // 生词面板是原生 details，默认折叠
    expect(page.get('.new-words').attributes('open')).toBeUndefined()
  })

  it('should store a selection in the store and sessionStorage', async () => {
    const page = await mountPage()
    const store = useReadingStore()

    const firstCard = page.get('[data-question-id="1"]')
    await firstCard.findAll('input[type="radio"]')[1].setChecked()
    await flushPromises()

    expect(store.answers[1]).toBe(1)
    expect(store.answeredCount).toBe(1)
    expect(JSON.parse(sessionStorage.getItem('wr.answers:r5'))).toEqual({ 1: 1 })
    expect(page.text()).toContain('已答 1 / 5')
  })

  it('should ask before submitting unanswered questions and then navigate', async () => {
    const page = await mountPage()
    const store = useReadingStore()

    await findButton(page, '提交答案').trigger('click')
    await flushPromises()

    expect(page.text()).toContain('还有 5 道题未作答')
    expect(page.text()).toContain('未作答的题目会按错误计算。')

    await findButton(page, '仍然提交').trigger('click')
    await flushPromises()

    expect(store.phase).toBe('submitted')
    expect(store.result.correctCount).toBe(0)
    expect(routerMocks.replace).toHaveBeenCalledWith({
      name: 'reading-result',
      params: { id: 'r5' },
    })
  })

  it('should confirm before leaving the practice', async () => {
    const page = await mountPage()

    await page.get('[aria-label="退出本次练习"]').trigger('click')
    await flushPromises()

    expect(page.text()).toContain('退出本次练习？')
    expect(page.text()).toContain('已作答内容会临时保存。')

    await findButton(page, '退出练习').trigger('click')
    await flushPromises()

    expect(routerMocks.push).toHaveBeenCalledWith('/history')
  })

  it('should render a not-found state without questions', async () => {
    routeState.id = 'r404'
    const page = await mountPage()

    expect(page.get('[role="alert"]').text()).toContain('这篇练习不存在或已被删除')
    expect(page.find('[data-question-id]').exists()).toBe(false)
    // 错误态也必须有唯一 h1
    expect(page.findAll('h1')).toHaveLength(1)

    await findButton(page, '返回首页').trigger('click')
    expect(routerMocks.push).toHaveBeenCalledWith('/')
  })
})
