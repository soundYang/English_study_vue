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
import { localStore, storageKeys } from '../../../unit/storage'

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
  // 本文件测登录后答题；游客整页引导另有独立用例（md/45 §5.7）
  localStore.set(storageKeys.accessToken, 'sess_reading_page')
  resetMockDb()
  setMockLatency(0)
  routeState.id = 'r5'
  routerMocks.replace.mockReset()
  routerMocks.push.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

afterAll(() => {
  setMockLatency(300)
})

async function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  // 详情浮层靠 isConnected 判断锚点还在不在，页面必须挂到真实文档上
  wrapper = mount(ReadingView, {
    attachTo: document.body,
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

describe('Reading page · guest', () => {
  it('should show the login gate without loading the reading', async () => {
    localStore.remove(storageKeys.accessToken)

    const page = await mountPage()
    const store = useReadingStore()

    // md/45 §5.7：没有正文就不渲染半残的答题界面，也不发详情请求
    expect(page.text()).toContain('请登录后查看这篇阅读')
    expect(page.findAll('.question-card')).toHaveLength(0)
    expect(store.reading).toBeNull()
    expect(store.loadError).toBeNull()
  })
})

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
    // 翻译只属于已提交的结果页；阅读页不传 ArticleCard 的 translation 插槽
    expect(page.find('.translation-card').exists()).toBe(false)
    // 用词 chip 在阅读页保持静态，不开放释义查询
    expect(page.find('.used-words button.chip').exists()).toBe(false)
  })

  it('should show the fallback message carried by the reading detail', async () => {
    const page = await mountPage()
    const store = useReadingStore()

    // 常规阅读没有兜底记录：不占正文上方的位置
    expect(page.find('.vocab-fallback-note').exists()).toBe(false)

    // 刷新 / 历史直达时详情仍带同一句（md/60 §5.6），原样展示
    store.reading = {
      ...store.reading,
      vocabFallback: {
        used: true,
        requestedScope: ['today_new'],
        scopeAvailable: 0,
        allAvailable: 20,
        needed: 15,
        supplemented: 15,
        message: '「今天新学」没有可用词，已从「全部词汇」补充 15 个候选词。',
      },
    }
    await flushPromises()

    expect(page.get('.vocab-fallback-note').text()).toBe(
      '「今天新学」没有可用词，已从「全部词汇」补充 15 个候选词。',
    )
  })

  it('should show the word count and the new-words entry in the title row', async () => {
    const page = await mountPage()
    const store = useReadingStore()

    // 词数以 DTO 给的 actualWords 为准，不在视图里重新数一遍
    expect(page.get('.article-meta').text()).toBe(`${store.reading.actualWords} 词`)
    // 入口在标题行里，文章正文之前就能看到
    expect(page.get('.article-head').text()).toContain('本文含 2 个未学单词')
    expect(page.get('.new-words-toggle').attributes('aria-expanded')).toBe('false')
    expect(page.find('.new-words-list').exists()).toBe(false)
  })

  it('should expand the new-words list from the entry', async () => {
    const page = await mountPage()

    await page.get('.new-words-toggle').trigger('click')

    expect(page.get('.new-words-toggle').attributes('aria-expanded')).toBe('true')
    const items = page.findAll('.new-word')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('dramatic')
    expect(items[0].text()).toContain('戏剧性的')
    expect(items[1].text()).toContain('uncertain')
  })

  it('should mark new words inside the article and open their detail on click', async () => {
    const page = await mountPage()
    const words = page.findAll('.article-new-word')

    // 正文里各出现一次，按原文词形显示，顺序跟着文章走
    expect(words.map((word) => word.text())).toEqual(['uncertain', 'dramatic'])

    await words[0].trigger('click')
    await flushPromises()

    const panel = page.get('.detail-popover')
    expect(panel.get('.detail-word').text()).toBe('uncertain')
    expect(panel.text()).toContain('不确定的')
    expect(panel.text()).toContain('来源')

    await words[0].trigger('click')
    await flushPromises()

    expect(page.find('.detail-popover').exists()).toBe(false)
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
