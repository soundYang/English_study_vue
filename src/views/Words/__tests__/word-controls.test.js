/**
 * 词汇局部组件测试
 * 覆盖搜索防抖/回车立即查询、添加表单的校验与成功清空、编辑弹窗的预填与提交。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import WordEditModal from '../component/WordEditModal.vue'
import WordFormPanel from '../component/WordFormPanel.vue'
import WordToolbar from '../component/WordToolbar.vue'

describe('WordToolbar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should debounce typing and search on Enter immediately', async () => {
    const wrapper = mount(WordToolbar, { props: { value: '' } })
    const input = wrapper.get('input')

    await input.setValue('app')
    expect(wrapper.emitted('search')).toBeUndefined()

    vi.advanceTimersByTime(299)
    expect(wrapper.emitted('search')).toBeUndefined()

    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('search')).toEqual([['app']])

    await input.setValue('apple')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('search')).toEqual([['app'], ['apple']])

    vi.advanceTimersByTime(300)
    expect(wrapper.emitted('search')).toHaveLength(2)

    wrapper.unmount()
  })

  it('should clear the keyword from the clear button', async () => {
    const wrapper = mount(WordToolbar, { props: { value: 'apple' } })

    await wrapper.get('button[aria-label="清除搜索"]').trigger('click')

    expect(wrapper.get('input').element.value).toBe('')
    expect(wrapper.emitted('search')).toEqual([['']])

    wrapper.unmount()
  })
})

describe('WordFormPanel', () => {
  it('should normalize the input, submit it and clear the text fields', async () => {
    const submitWord = vi.fn().mockResolvedValue({ ok: true })
    const wrapper = mount(WordFormPanel, { props: { submitWord } })
    const inputs = wrapper.findAll('input')

    await inputs[0].setValue('Apple')
    await inputs[1].setValue('苹果')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(submitWord).toHaveBeenCalledWith({
      word: 'apple',
      status: 'learning',
      source: 'manual',
      meaning: '苹果',
      senses: [{ pos: '', meaning: '苹果' }],
    })
    expect(inputs[0].element.value).toBe('')
    expect(inputs[1].element.value).toBe('')
  })

  it('should show validation errors without calling the API when the word is empty', async () => {
    const submitWord = vi.fn()
    const wrapper = mount(WordFormPanel, { props: { submitWord } })

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(submitWord).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请输入英文单词')
  })

  it('should keep the input and show the field error when the word already exists', async () => {
    const submitWord = vi.fn().mockResolvedValue({
      ok: false,
      errors: { word: '这个单词已经在词库中了' },
    })
    const wrapper = mount(WordFormPanel, { props: { submitWord } })
    const inputs = wrapper.findAll('input')

    await inputs[0].setValue('apple')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('这个单词已经在词库中了')
    expect(inputs[0].element.value).toBe('apple')
  })
})

describe('WordEditModal', () => {
  it('should prefill the word and emit the updated payload for a manual entry', async () => {
    const word = {
      id: 'w1',
      word: 'apple',
      status: 'mastered',
      source: 'manual',
      dictionaryId: null,
      phonetic: null,
      senses: [{ pos: '', meaning: '苹果' }],
    }
    const saveWord = vi.fn().mockResolvedValue({
      ok: true,
      item: { ...word, senses: [{ pos: '', meaning: '苹果汁' }] },
    })

    const wrapper = mount(WordEditModal, {
      props: { open: true, word, saveWord },
      global: { stubs: { teleport: true } },
    })
    await flushPromises()

    const inputs = wrapper.findAll('input')
    expect(inputs[0].element.value).toBe('apple')
    expect(inputs[1].element.value).toBe('苹果')

    await inputs[1].setValue('苹果汁')
    const saveButton = wrapper.findAll('button').find((button) => button.text() === '保存')
    await saveButton.trigger('click')
    await flushPromises()

    expect(saveWord).toHaveBeenCalledWith('w1', {
      word: 'apple',
      meaning: '苹果汁',
      status: 'mastered',
    })
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('should render a dictionary entry read-only and omit meaning from the payload', async () => {
    const word = {
      id: 'w1',
      word: 'apple',
      status: 'mastered',
      source: 'dictionary',
      dictionaryId: 'dict_apple',
      phonetic: { uk: '/ˈæp.əl/', us: '/ˈæp.əl/' },
      senses: [
        { pos: 'n.', meaning: '苹果' },
        { pos: 'n.', meaning: '苹果树' },
      ],
    }
    const saveWord = vi.fn().mockResolvedValue({ ok: true, item: word })

    const wrapper = mount(WordEditModal, {
      props: { open: true, word, saveWord },
      global: { stubs: { teleport: true } },
    })
    await flushPromises()

    // 只剩单词一个输入框，释义改为只读列表
    expect(wrapper.findAll('input')).toHaveLength(1)
    expect(wrapper.text()).toContain('苹果树')
    expect(wrapper.text()).toContain('/ˈæp.əl/')

    const saveButton = wrapper.findAll('button').find((button) => button.text() === '保存')
    await saveButton.trigger('click')
    await flushPromises()

    expect(saveWord).toHaveBeenCalledWith('w1', { word: 'apple', status: 'mastered' })
  })

  it('should warn before downgrading a dictionary entry when the word changes', async () => {
    const word = {
      id: 'w1',
      word: 'apple',
      status: 'mastered',
      source: 'dictionary',
      dictionaryId: 'dict_apple',
      phonetic: { uk: '/ˈæp.əl/', us: '/ˈæp.əl/' },
      senses: [{ pos: 'n.', meaning: '苹果' }],
    }
    const saveWord = vi.fn().mockResolvedValue({ ok: true, item: { ...word, source: 'manual' } })

    const wrapper = mount(WordEditModal, {
      props: { open: true, word, saveWord },
      global: { stubs: { teleport: true } },
    })
    await flushPromises()

    await wrapper.get('input').setValue('apples')

    expect(wrapper.text()).toContain('转为手动录入')
    const confirmButton = wrapper.findAll('button').find((button) => button.text() === '确认修改')
    expect(confirmButton).toBeTruthy()

    await confirmButton.trigger('click')
    await flushPromises()

    expect(saveWord).toHaveBeenCalledWith('w1', { word: 'apples', status: 'mastered' })
  })
})
