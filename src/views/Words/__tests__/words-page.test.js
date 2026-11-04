/**
 * 我的单词页面测试
 * 覆盖书页渲染、搜索 / 空态、详情与写词纸页、删除与批量改状态；
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
      { path: '/words/banks', name: 'words-banks', component: { template: '<div />' } },
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

function entries() {
  return wrapper.findAll('.word-entry')
}

async function openWritePage() {
  await wrapper.get('button.add-button').trigger('click')
  await flushPromises()
}

describe('Words page', () => {
  it('should render a two-page book with 12 entries and the accumulated total', async () => {
    await mountPage()

    expect(wrapper.findAll('.book-page')).toHaveLength(2)
    expect(entries()).toHaveLength(12)
    expect(wrapper.text()).toContain('24')
    expect(wrapper.text()).toContain('共 24 条')
    // 一摊两页，每页 6 条
    expect(wrapper.get('.book-page--left').findAll('.word-entry')).toHaveLength(6)
    expect(wrapper.get('.book-page--right').findAll('.word-entry')).toHaveLength(6)
  })

  it('should search, show the no-result state and clear the keyword', async () => {
    await mountPage()
    const input = wrapper.get('input[type="search"]')

    await input.setValue('appl')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(entries()).toHaveLength(1)
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
    expect(entries()).toHaveLength(12)
  })

  // 已掌握 / 复习中都要覆盖：两个标签走的是同一条 fetchList，
  // 但列表长度不同，曾经在点标签时整块换成骨架屏而闪一下。
  it.each([
    ['复习中', 2, 'reviewing'],
    ['已掌握', 3, 'mastered'],
  ])('should keep the current entries while switching to %s', async (_, tabIndex, study) => {
    await mountPage()
    const store = useWordsStore()
    const rows = entries()

    expect(rows).toHaveLength(12)
    const firstRow = rows[0].element

    // 真实网络下切换状态需要时间：这段时间继续显示旧词条，
    // 不能整块换成骨架屏，否则每点一次标签都会闪一下。
    setMockLatency(60)
    await wrapper.findAll('.status-chip')[tabIndex].trigger('click')

    expect(store.study).toBe(study)
    expect(wrapper.findAll('.skeleton-line')).toHaveLength(0)
    // 旧词条还是同一批 DOM 节点，没有被重建
    expect(entries()[0].element).toBe(firstRow)
    // 底部也不能在加载中被抽走，否则页面高度会抖一下
    expect(wrapper.find('.list-footer').exists()).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 80))
    await flushPromises()

    expect(store.items.every((item) => item.studyState === study)).toBe(true)
    expect(entries()).toHaveLength(store.items.length)
    expect(wrapper.findAll('.skeleton-line')).toHaveLength(0)
  })

  // 用户反馈的场景：两个标签都为空，点标签时页面仍会闪一下。
  // 种子数据里「新词」「已排除」天然都是空的（没有今天的词、没有墓碑）
  it('should keep the empty state when switching between two empty tabs', async () => {
    await mountPage()
    const store = useWordsStore()

    await wrapper.findAll('.status-chip')[1].trigger('click')
    await flushPromises()

    expect(store.hasItems).toBe(false)
    expect(wrapper.text()).toContain('这个状态下还没有单词')
    const emptyElement = wrapper.get('.words-empty').element

    setMockLatency(60)
    await wrapper.get('.status-excluded').trigger('click')

    expect(store.study).toBe('removed')
    // 「已排除」是排除标记：切过去时常驻一行说明，别让用户以为是学习阶段
    expect(wrapper.get('.status-hint').text()).toContain('不会用于生成文章')
    // 空态切空态：不能挂上骨架，原来的空态节点保持不动
    expect(wrapper.findAll('.skeleton-line')).toHaveLength(0)
    expect(wrapper.find('.word-book').exists()).toBe(false)
    expect(wrapper.get('.words-empty').element).toBe(emptyElement)

    await new Promise((resolve) => setTimeout(resolve, 80))
    await flushPromises()

    expect(store.hasItems).toBe(false)
    expect(wrapper.findAll('.skeleton-line')).toHaveLength(0)
    expect(wrapper.get('.words-empty').element).toBe(emptyElement)
    expect(wrapper.text()).toContain('还没有已排除的词')
  })

  it('should keep the empty state until entries arrive when switching to a non-empty tab', async () => {
    await mountPage()
    const store = useWordsStore()

    await wrapper.findAll('.status-chip')[1].trigger('click')
    await flushPromises()

    expect(store.hasItems).toBe(false)
    const emptyElement = wrapper.get('.words-empty').element

    setMockLatency(60)
    await wrapper.findAll('.status-chip')[2].trigger('click')

    // 空态 → 有数据：加载中仍显示空态，不闪骨架
    expect(store.study).toBe('reviewing')
    expect(wrapper.findAll('.skeleton-line')).toHaveLength(0)
    expect(wrapper.get('.words-empty').element).toBe(emptyElement)

    await new Promise((resolve) => setTimeout(resolve, 80))
    await flushPromises()

    expect(store.items.length).toBeGreaterThan(0)
    expect(entries()).toHaveLength(store.items.length)
    expect(wrapper.findAll('.skeleton-line')).toHaveLength(0)
    expect(wrapper.find('.words-empty').exists()).toBe(false)
  })

  it('should keep the empty copy while reloading after a search is cleared', async () => {
    await mountPage()
    const input = wrapper.get('input[type="search"]')

    await input.setValue('zzzz')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('没有找到匹配的单词')

    const clearButton = wrapper.findAll('button').find((button) => button.text() === '清除搜索')
    setMockLatency(60)
    await clearButton.trigger('click')

    // 加载期间继续显示点击前看到的空态文案，不会先变成「还没有单词」再换列表
    expect(wrapper.findAll('.skeleton-line')).toHaveLength(0)
    expect(wrapper.text()).toContain('没有找到匹配的单词')
    expect(wrapper.text()).not.toContain('还没有单词')

    await new Promise((resolve) => setTimeout(resolve, 80))
    await flushPromises()

    expect(entries()).toHaveLength(12)
    expect(wrapper.find('.words-empty').exists()).toBe(false)
  })

  it('should still show the skeleton on the first load', async () => {
    setMockLatency(60)
    await mountPage()

    // 还没有任何成功结果，首次进入照常出骨架
    expect(wrapper.findAll('.skeleton-line').length).toBeGreaterThan(0)

    await new Promise((resolve) => setTimeout(resolve, 80))
    await flushPromises()

    expect(wrapper.findAll('.skeleton-line')).toHaveLength(0)
    expect(entries()).toHaveLength(12)
  })

  it('should open the detail page when a word is clicked and return to the book', async () => {
    await mountPage()
    const trigger = entries()[0].get('.entry-word')
    const word = trigger.text()

    await trigger.trigger('click')
    await flushPromises()

    const page = wrapper.get('.word-detail-page')
    expect(page.get('.detail-word').text()).toBe(word)
    expect(page.text()).toContain('词义')
    expect(page.text()).toContain('词库来源')
    expect(page.text()).toContain('收录日期')
    // 列表被整页替换
    expect(wrapper.find('.book-spread').exists()).toBe(false)

    await page.get('.back-link').trigger('click')
    await flushPromises()

    expect(wrapper.find('.word-detail-page').exists()).toBe(false)
    expect(wrapper.find('.book-spread').exists()).toBe(true)
  })

  it('should add a word from the write page and return to the book', async () => {
    await mountPage()
    const toasts = useToastStore()

    await openWritePage()
    expect(wrapper.find('.word-write-page').isVisible()).toBe(true)

    await wrapper.get('input[name="word"]').setValue('zebra')
    await wrapper.get('input[name="meaning"]').setValue('斑马')
    await wrapper.get('form.word-form').trigger('submit')
    await flushPromises()

    const store = useWordsStore()
    expect(store.total).toBe(25)
    expect(toasts.items.map((item) => item.message)).toContain('已添加 zebra')

    await wrapper.get('.back-link').trigger('click')
    await flushPromises()

    expect(entries()[0].text()).toContain('zebra')
  })

  it('should say the word was updated when adding a duplicate', async () => {
    await mountPage()
    const toasts = useToastStore()

    await openWritePage()
    await wrapper.get('input[name="word"]').setValue('APPLE')
    await wrapper.get('form.word-form').trigger('submit')
    await flushPromises()

    const store = useWordsStore()
    expect(store.total).toBe(24)
    expect(toasts.items.map((item) => item.message)).toContain('已更新 apple 的学习状态')
  })

  it('should paste a list, preview it and import it', async () => {
    await mountPage()
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
    await mountPage()
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

  it('should confirm before deleting a word from the entry menu', async () => {
    await mountPage()
    const store = useWordsStore()
    const toasts = useToastStore()

    const firstWord = entries()[0].get('.entry-word').text()
    await entries()[0].get('.menu-trigger').trigger('click')
    const deleteItem = entries()[0]
      .findAll('.menu-item')
      .find((item) => item.text() === '删除')
    await deleteItem.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('历史阅读中的词汇快照不会受影响。')

    const confirmButton = wrapper.findAll('button').find((button) => button.text() === '删除')
    await confirmButton.trigger('click')
    await flushPromises()

    expect(store.total).toBe(23)
    expect(toasts.items.map((item) => item.message)).toContain(`已删除 ${firstWord}`)
  })

  it('should select entries, show the batch bar and clear selection on tab change', async () => {
    await mountPage()
    const checks = wrapper.findAll('.word-entry input[type="checkbox"]')
    expect(checks).toHaveLength(12)

    await checks[0].setValue(true)

    expect(wrapper.get('.batch-bar').text()).toContain('已选 1 个')
    expect(
      wrapper
        .get('select.batch-target')
        .findAll('option')
        .map((option) => option.text()),
    ).toEqual(['复习中', '已掌握', '已排除'])

    // 全选只作用于当前这一摊：12 条，不再是全部 24 条
    await wrapper.get('.page-select input[type="checkbox"]').setValue(true)
    expect(wrapper.get('.batch-bar').text()).toContain('已选 12 个')

    await wrapper.findAll('.status-chip')[2].trigger('click')
    await flushPromises()

    expect(wrapper.find('.batch-bar').exists()).toBe(false)
  })

  it('should confirm before marking words mastered and report unchanged entries', async () => {
    await mountPage()
    const toasts = useToastStore()
    const store = useWordsStore()
    // 第一页里已经 mastered 的词，批量再标一次只会是「未变化」
    const masteredRows = entries()
      .filter((row) => row.text().includes('已掌握'))
      .slice(0, 2)
    expect(store.items.filter((item) => item.studyState === 'mastered').length).toBeGreaterThan(1)

    for (const row of masteredRows) {
      await row.get('input[type="checkbox"]').setValue(true)
    }

    await wrapper.get('select.batch-target').setValue('mastered')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '应用')
      .trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('把选中的 2 个词标为「已掌握」？')

    await wrapper
      .findAll('button')
      .find((button) => button.text() === '标为已掌握')
      .trigger('click')
    await flushPromises()

    expect(toasts.items.map((item) => item.message)).toContain('2 个未变化')
    expect(wrapper.find('.batch-bar').exists()).toBe(false)
  })

  it('should confirm exclusion and drop the entries from the all tab', async () => {
    await mountPage()
    const store = useWordsStore()
    const toasts = useToastStore()
    const firstRow = entries()[0]
    const word = firstRow.get('.entry-word').text()

    await firstRow.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('select.batch-target').setValue('removed')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '应用')
      .trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('把选中的 1 个词标为「已排除」？')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '标为已排除')
      .trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain(word)
    expect(store.studyCounts.removed).toBe(1)
    expect(toasts.items.map((item) => item.message)).toContain('已更新 1 个词')
  })

  it('should switch to collage mode and keep the same entries', async () => {
    await mountPage()
    const collageButton = wrapper
      .findAll('.view-option')
      .find((button) => button.text() === '拼贴模式')

    await collageButton.trigger('click')
    await flushPromises()

    expect(wrapper.find('.book-spread').exists()).toBe(false)
    expect(wrapper.findAll('.collage .word-entry')).toHaveLength(12)
    expect(localStore.get(storageKeys.wordsViewMode)).toBe('collage')
  })
})
