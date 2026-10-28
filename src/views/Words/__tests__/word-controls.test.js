/**
 * 词汇局部组件测试
 * 覆盖搜索防抖/回车立即查询、添加表单的校验与成功清空、编辑弹窗的预填与提交。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import WordEditModal from '../component/WordEditModal.vue'
import WordFormPanel from '../component/WordFormPanel.vue'
import WordTable from '../component/WordTable.vue'
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

describe('WordTable', () => {
  const TOMATO = {
    id: 'w1',
    word: 'tomato',
    status: 'learning',
    createdAt: '2026-09-01T08:00:00.000Z',
    source: 'dictionary',
    cocaRank: 4321,
    dictionaryId: 'dict_tomato',
    phonetic: { uk: '/təˈmɑː.təʊ/', us: '/təˈmeɪ.toʊ/' },
    senses: [{ pos: 'n.', meaning: '西红柿' }],
  }

  // 桌面表格与移动卡片同时在 DOM 里，断言要限定在 .word-table 内
  it('should render both phonetics when they differ', () => {
    const wrapper = mount(WordTable, { props: { items: [TOMATO] } })
    const phonetic = wrapper.get('.cell-phonetic')

    expect(phonetic.text()).toContain('英 /təˈmɑː.təʊ/')
    expect(phonetic.text()).toContain('美 /təˈmeɪ.toʊ/')
    expect(phonetic.findAll('.phonetic-part')).toHaveLength(2)
    // 卡片用同一个函数，所以两处都是两份
    expect(wrapper.get('.card-phonetic').findAll('.phonetic-part')).toHaveLength(2)
  })

  it('should render one phonetic when both accents are the same', () => {
    const wrapper = mount(WordTable, {
      props: { items: [{ ...TOMATO, phonetic: { uk: '/ˈæp.əl/', us: '/ˈæp.əl/' } }] },
    })

    expect(wrapper.get('.cell-phonetic').findAll('.phonetic-part')).toHaveLength(1)
    expect(wrapper.get('.cell-phonetic').text()).toBe('英 /ˈæp.əl/')
  })

  it('should mark the source and the frequency tier of every word', () => {
    const wrapper = mount(WordTable, { props: { items: [TOMATO] } })

    expect(wrapper.get('.word-table .word-source').text()).toBe('词库')
    // 4321 落在 3001–8000，是中频
    expect(wrapper.get('.word-table .word-freq').text()).toBe('中频')
    expect(wrapper.get('.cell-created').text()).toBe('2026-09-01')
  })

  it('should mark manual words and hide the frequency badge when rank is missing', () => {
    const wrapper = mount(WordTable, {
      props: {
        items: [
          {
            ...TOMATO,
            word: 'story',
            source: 'manual',
            cocaRank: null,
            dictionaryId: null,
            phonetic: null,
            senses: [{ pos: '', meaning: '故事' }],
          },
        ],
      },
    })

    expect(wrapper.get('.word-table .word-source').text()).toBe('手填')
    // null 不是「第 0 名」，不能兜底成高频
    expect(wrapper.find('.word-freq').exists()).toBe(false)
    expect(wrapper.get('.cell-phonetic').text()).toBe('—')
    // 手填词也没有音标，卡片上同样是占位符
    expect(wrapper.get('.card-phonetic').text()).toBe('—')
  })

  it('should emit detail with the clicked word as the anchor', async () => {
    const wrapper = mount(WordTable, { props: { items: [TOMATO] } })
    const trigger = wrapper.get('.word-text')

    await trigger.trigger('click')

    const [[payload]] = wrapper.emitted('detail')
    expect(payload.item).toEqual(TOMATO)
    expect(payload.anchor).toBe(trigger.element)
  })

  it('should sync aria-expanded on both the table and the mobile card', () => {
    const wrapper = mount(WordTable, { props: { items: [TOMATO], expandedWord: 'tomato' } })

    expect(wrapper.get('.word-text').attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.card-word').attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.word-text').attributes('aria-haspopup')).toBe('dialog')
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
