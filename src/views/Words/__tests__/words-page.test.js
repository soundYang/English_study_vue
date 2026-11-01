/**
 * 我的单词页面测试
 * 覆盖首屏列表与统计、搜索/无结果/清除搜索、添加与删除的完整交互；
 * 使用真实 mock adapter（延迟 0），不依赖 300ms 等待。
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import WordsView from '../index.vue'
import { resetMockDb, setMockLatency } from '../../../mock/adapter'
import { useToastStore } from '../../../stores/model/toast'
import { useWordsStore } from '../../../stores/model/words'
import { localStore, storageKeys } from '../../../unit/storage'

let wrapper = null

beforeEach(() => {
  localStorage.clear()
  // 本文件测的是登录后的完整交互；游客态的分支另有独立用例（md/45）
  localStore.set(storageKeys.accessToken, 'sess_words_page')
  resetMockDb()
  setMockLatency(0)
})

// 详情浮层要靠 isConnected 判断锚点还在不在，所以页面必须挂到真实文档上
afterEach(() => {
  if (wrapper) wrapper.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

afterAll(() => {
  setMockLatency(300)
})

async function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  // 今日复习入口条用 RouterLink 指到 /words/review，页面测试也要有路由
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/words', name: 'words', component: { template: '<div />' } },
      { path: '/words/review', name: 'words-review', component: { template: '<div />' } },
    ],
  })
  await router.push('/words')
  await router.isReady()

  wrapper = mount(WordsView, {
    attachTo: document.body,
    global: {
      plugins: [pinia, router],
      stubs: { teleport: true, 'transition-group': false },
    },
  })
  await flushPromises()
  return wrapper
}

describe('Words page', () => {
  it('should render the first page and the accumulated total', async () => {
    const wrapper = await mountPage()

    expect(wrapper.findAll('tbody tr.word-row')).toHaveLength(10)
    expect(wrapper.text()).toContain('24')
    expect(wrapper.text()).toContain('共 24 条')
  })

  it('should search, show the no-result state and clear the keyword', async () => {
    const wrapper = await mountPage()
    const input = wrapper.get('input[type="search"]')

    await input.setValue('appl')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.findAll('tbody tr.word-row')).toHaveLength(1)
    expect(wrapper.text()).toContain('apple')
    expect(wrapper.text()).toContain('找到 1 个单词')

    await input.setValue('zzzz')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('没有找到匹配的单词')

    const clearButton = wrapper.findAll('button').find((button) => button.text() === '清除搜索')
    await clearButton.trigger('click')
    await flushPromises()

    expect(input.element.value).toBe('')
    expect(wrapper.findAll('tbody tr.word-row')).toHaveLength(10)
  })

  // 已掌握 / 复习中都要覆盖：两个标签走的是同一条 fetchList，
  // 但列表长度不同（11 / 13），曾经在点标签时整表换成骨架屏而闪一下。
  // 标签页按 studyState 分档（md/22 第 96 行）：全部 / 新词 / 复习中 / 已掌握 / 不认识
  it.each([
    ['复习中', 2, 'reviewing'],
    ['已掌握', 3, 'mastered'],
  ])('should keep the current rows while switching to %s', async (_, tabIndex, study) => {
    const wrapper = await mountPage()
    const store = useWordsStore()
    const rows = wrapper.findAll('tbody tr.word-row')

    expect(rows).toHaveLength(10)
    const firstRow = rows[0].element

    // 真实网络下切换状态需要时间：这段时间继续显示旧行，
    // 不能整表换成骨架屏，否则每点一次标签都会闪一下。
    setMockLatency(60)
    await wrapper.findAll('[role="radio"]')[tabIndex].trigger('click')

    expect(store.study).toBe(study)
    expect(wrapper.findAll('tbody tr.skeleton-row')).toHaveLength(0)
    // 旧行还是同一批 DOM 节点，没有被重建
    expect(wrapper.findAll('tbody tr.word-row')[0].element).toBe(firstRow)
    // 底部分页也不能在加载中被抽走，否则页面高度会抖一下
    expect(wrapper.find('.list-footer').exists()).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 80))
    await flushPromises()

    expect(store.items.every((item) => item.studyState === study)).toBe(true)
    expect(wrapper.findAll('tbody tr.word-row')).toHaveLength(store.items.length)
    expect(wrapper.findAll('tbody tr.skeleton-row')).toHaveLength(0)
  })

  // 用户反馈的场景：两个标签都为空，点标签时页面仍会闪一下。
  // 原因是旧列表为空时页面挂上了列表骨架，回来后又变回空态。
  // 种子数据里「新词」「不认识」天然都是空的（没有今天的词、没有墓碑），不用造数据
  it('should keep the empty state when switching between two empty tabs', async () => {
    const wrapper = await mountPage()
    const store = useWordsStore()

    await wrapper.findAll('[role="radio"]')[1].trigger('click')
    await flushPromises()

    expect(store.hasItems).toBe(false)
    expect(wrapper.text()).toContain('这个状态下还没有单词')
    const emptyElement = wrapper.get('.words-empty').element

    setMockLatency(60)
    await wrapper.findAll('[role="radio"]')[4].trigger('click')

    expect(store.study).toBe('removed')
    // 空态切空态：不能挂上列表骨架，原来的空态节点保持不动
    expect(wrapper.findAll('tbody tr.skeleton-row')).toHaveLength(0)
    expect(wrapper.find('.word-table-wrap').exists()).toBe(false)
    expect(wrapper.get('.words-empty').element).toBe(emptyElement)

    await new Promise((resolve) => setTimeout(resolve, 80))
    await flushPromises()

    expect(store.hasItems).toBe(false)
    expect(wrapper.findAll('tbody tr.skeleton-row')).toHaveLength(0)
    expect(wrapper.get('.words-empty').element).toBe(emptyElement)
    expect(wrapper.text()).toContain('这个状态下还没有单词')
  })

  it('should keep the empty state until rows arrive when switching to a non-empty tab', async () => {
    const wrapper = await mountPage()
    const store = useWordsStore()

    await wrapper.findAll('[role="radio"]')[1].trigger('click')
    await flushPromises()

    expect(store.hasItems).toBe(false)
    const emptyElement = wrapper.get('.words-empty').element

    setMockLatency(60)
    await wrapper.findAll('[role="radio"]')[2].trigger('click')

    // 空态 → 有数据：加载中仍显示空态，不闪骨架，也不留下半张空表格
    expect(store.study).toBe('reviewing')
    expect(wrapper.findAll('tbody tr.skeleton-row')).toHaveLength(0)
    expect(wrapper.get('.words-empty').element).toBe(emptyElement)

    await new Promise((resolve) => setTimeout(resolve, 80))
    await flushPromises()

    expect(store.items.length).toBeGreaterThan(0)
    expect(wrapper.findAll('tbody tr.word-row')).toHaveLength(store.items.length)
    expect(wrapper.findAll('tbody tr.skeleton-row')).toHaveLength(0)
    expect(wrapper.find('.words-empty').exists()).toBe(false)
  })

  it('should keep the empty copy while reloading after a search is cleared', async () => {
    const wrapper = await mountPage()
    const input = wrapper.get('input[type="search"]')

    await input.setValue('zzzz')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('没有找到匹配的单词')

    const clearButton = wrapper.findAll('button').find((button) => button.text() === '清除搜索')
    setMockLatency(60)
    await clearButton.trigger('click')

    // 加载期间继续显示点击前看到的空态文案，不会先变成「还没有单词」再换列表
    expect(wrapper.findAll('tbody tr.skeleton-row')).toHaveLength(0)
    expect(wrapper.text()).toContain('没有找到匹配的单词')
    expect(wrapper.text()).not.toContain('还没有单词')

    await new Promise((resolve) => setTimeout(resolve, 80))
    await flushPromises()

    expect(wrapper.findAll('tbody tr.word-row')).toHaveLength(10)
    expect(wrapper.find('.words-empty').exists()).toBe(false)
  })

  it('should still show the skeleton on the first load', async () => {
    setMockLatency(60)
    const wrapper = await mountPage()

    // 还没有任何成功结果，首次进入照常出骨架
    expect(wrapper.findAll('tbody tr.skeleton-row').length).toBeGreaterThan(0)

    await new Promise((resolve) => setTimeout(resolve, 80))
    await flushPromises()

    expect(wrapper.findAll('tbody tr.skeleton-row')).toHaveLength(0)
    expect(wrapper.findAll('tbody tr.word-row')).toHaveLength(10)
  })

  it('should show the word detail when the word itself is clicked', async () => {
    const wrapper = await mountPage()
    const trigger = wrapper.findAll('tbody .word-text')[0]
    const word = trigger.text()

    await trigger.trigger('click')
    await flushPromises()

    const panel = wrapper.get('.detail-popover')
    expect(panel.get('.detail-word').text()).toBe(word)
    expect(panel.text()).toContain('来源')
    expect(panel.text()).toContain('收录')
    expect(trigger.attributes('aria-expanded')).toBe('true')

    await trigger.trigger('click')
    await flushPromises()

    expect(wrapper.find('.detail-popover').exists()).toBe(false)
  })

  it('should add a word from the side form and highlight it', async () => {
    const wrapper = await mountPage()
    const toasts = useToastStore()

    await wrapper.get('input[name="word"]').setValue('zebra')
    await wrapper.get('input[name="meaning"]').setValue('斑马')
    await wrapper.get('form.word-form').trigger('submit')
    await flushPromises()

    const store = useWordsStore()
    expect(store.total).toBe(25)
    expect(wrapper.findAll('tbody tr.word-row')[0].text()).toContain('zebra')
    expect(toasts.items.map((item) => item.message)).toContain('已添加 zebra')
  })

  it('should say the word was updated when adding a duplicate', async () => {
    const wrapper = await mountPage()
    const toasts = useToastStore()

    await wrapper.get('input[name="word"]').setValue('APPLE')
    await wrapper.get('form.word-form').trigger('submit')
    await flushPromises()

    const store = useWordsStore()
    expect(store.total).toBe(24)
    expect(toasts.items.map((item) => item.message)).toContain('已更新 apple 的学习状态')
  })

  it('should paste a list, preview it and import it', async () => {
    const wrapper = await mountPage()
    const store = useWordsStore()
    const toasts = useToastStore()

    const batchButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('批量导入'))
    await batchButton.trigger('click')
    await flushPromises()

    await wrapper.get('textarea.batch-textarea').setValue('zebra 斑马\norchid')

    const previewButton = wrapper.findAll('button').find((button) => button.text() === '预览')
    await previewButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('将新增 2 个')
    expect(wrapper.findAll('.preview-item')).toHaveLength(2)

    const importButton = wrapper.findAll('button').find((button) => button.text() === '确认导入')
    await importButton.trigger('click')
    await flushPromises()

    expect(store.total).toBe(26)
    expect(wrapper.text()).toContain('新增 2 个，更新 0 个')
    expect(toasts.items.map((item) => item.message)).toContain('批量导入完成：新增 2 个')
  })

  it('should upload a text file, preview it and import it', async () => {
    const wrapper = await mountPage()
    const store = useWordsStore()
    const toasts = useToastStore()

    const batchButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('批量导入'))
    await batchButton.trigger('click')
    await flushPromises()

    const fileTab = wrapper.findAll('button').find((button) => button.text() === '上传文件')
    await fileTab.trigger('click')
    await flushPromises()

    const input = wrapper.get('input[type="file"]')
    const file = new File(['zebra 斑马\norchid'], 'words.txt', { type: 'text/plain' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('已读取 2 条')

    const importButton = wrapper.findAll('button').find((button) => button.text() === '确认导入')
    await importButton.trigger('click')
    await flushPromises()

    expect(store.total).toBe(26)
    expect(wrapper.text()).toContain('新增 2 个，更新 0 个')
    expect(toasts.items.map((item) => item.message)).toContain('批量导入完成：新增 2 个')
  })

  it('should confirm before deleting a word', async () => {
    const wrapper = await mountPage()
    const store = useWordsStore()
    const toasts = useToastStore()

    // .cell-word 里现在还有来源/词频徽标，只取词形本身
    const firstWord = wrapper.findAll('tbody tr.word-row')[0].find('.word-text').text()
    const deleteButton = wrapper
      .findAll('button')
      .find((button) => button.attributes('aria-label') === `删除 ${firstWord}`)

    await deleteButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('历史阅读中的词汇快照不会受影响。')

    const confirmButton = wrapper.findAll('button').find((button) => button.text() === '删除')
    await confirmButton.trigger('click')
    await flushPromises()

    expect(store.total).toBe(23)
    expect(toasts.items.map((item) => item.message)).toContain(`已删除 ${firstWord}`)
  })
})
