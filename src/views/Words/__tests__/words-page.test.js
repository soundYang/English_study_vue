/**
 * 我的单词页面测试
 * 覆盖首屏列表与统计、搜索/无结果/清除搜索、添加与删除的完整交互；
 * 使用真实 mock adapter（延迟 0），不依赖 300ms 等待。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import WordsView from '../index.vue'
import { resetMockDb, setMockLatency } from '../../../mock/adapter'
import { useToastStore } from '../../../stores/model/toast'
import { useWordsStore } from '../../../stores/model/words'

beforeEach(() => {
  localStorage.clear()
  resetMockDb()
  setMockLatency(0)
})

afterAll(() => {
  setMockLatency(300)
})

async function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(WordsView, {
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
