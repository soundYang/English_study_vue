/**
 * 我的单词页面测试
 * 覆盖首屏列表与统计、搜索/无结果/清除搜索、添加与删除的完整交互；
 * 使用真实 mock adapter（延迟 0），不依赖 300ms 等待。
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import WordsView from '../index.vue'
import { resetMockDb, setMockLatency } from '../../../mock/adapter'
import { useToastStore } from '../../../stores/model/toast'
import { useWordsStore } from '../../../stores/model/words'

let wrapper = null

beforeEach(() => {
  localStorage.clear()
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
  wrapper = mount(WordsView, {
    attachTo: document.body,
    global: {
      plugins: [pinia],
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

  // 已掌握 / 学习中 / 未学习都要覆盖：三个标签走的是同一条 fetchList，
  // 但列表长度不同（11 / 9 / 4），曾经在点标签时整表换成骨架屏而闪一下。
  it.each([
    ['已掌握', 1, 'mastered'],
    ['学习中', 2, 'learning'],
    ['未学习', 3, 'new'],
  ])('should keep the current rows while switching to %s', async (_, tabIndex, status) => {
    const wrapper = await mountPage()
    const store = useWordsStore()
    const rows = wrapper.findAll('tbody tr.word-row')

    expect(rows).toHaveLength(10)
    const firstRow = rows[0].element

    // 真实网络下切换状态需要时间：这段时间继续显示旧行，
    // 不能整表换成骨架屏，否则每点一次标签都会闪一下。
    setMockLatency(60)
    await wrapper.findAll('[role="radio"]')[tabIndex].trigger('click')

    expect(store.status).toBe(status)
    expect(wrapper.findAll('tbody tr.skeleton-row')).toHaveLength(0)
    // 旧行还是同一批 DOM 节点，没有被重建
    expect(wrapper.findAll('tbody tr.word-row')[0].element).toBe(firstRow)
    // 底部分页也不能在加载中被抽走，否则页面高度会抖一下
    expect(wrapper.find('.list-footer').exists()).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 80))
    await flushPromises()

    expect(store.items.every((item) => item.status === status)).toBe(true)
    expect(wrapper.findAll('tbody tr.word-row')).toHaveLength(store.items.length)
    expect(wrapper.findAll('tbody tr.skeleton-row')).toHaveLength(0)
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
