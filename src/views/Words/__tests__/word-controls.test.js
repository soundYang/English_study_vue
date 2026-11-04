/**
 * 词汇局部组件测试
 * 覆盖搜索防抖/回车立即查询、添加表单的校验与成功清空、编辑弹窗的预填与提交。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import WordBook from '../component/WordBook.vue'
import WordEditModal from '../component/WordEditModal.vue'
import WordEntry from '../component/WordEntry.vue'
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

describe('WordEntry', () => {
  const TOMATO = {
    id: 'w1',
    word: 'tomato',
    status: 'learning',
    studyState: 'reviewing',
    reviewStage: 0,
    createdAt: '2026-09-01T08:00:00.000Z',
    source: 'dictionary',
    cocaRank: 4321,
    dictionaryId: 'dict_tomato',
    phonetic: { uk: '/təˈmɑː.təʊ/', us: '/təˈmeɪ.toʊ/' },
    senses: [{ pos: 'n.', meaning: '西红柿' }],
    wordBanks: [],
  }

  it('should render both phonetics when they differ', () => {
    const wrapper = mount(WordEntry, { props: { item: TOMATO } })
    const phonetic = wrapper.get('.entry-phonetic')

    expect(phonetic.text()).toContain('英 /təˈmɑː.təʊ/')
    expect(phonetic.text()).toContain('美 /təˈmeɪ.toʊ/')
    expect(phonetic.findAll('.phonetic-part')).toHaveLength(2)
  })

  it('should render one phonetic when both accents are the same', () => {
    const wrapper = mount(WordEntry, {
      props: { item: { ...TOMATO, phonetic: { uk: '/ˈæp.əl/', us: '/ˈæp.əl/' } } },
    })

    expect(wrapper.get('.entry-phonetic').findAll('.phonetic-part')).toHaveLength(1)
    expect(wrapper.get('.entry-phonetic').text()).toBe('英 /ˈæp.əl/')
  })

  it('should mark the bank source, the status and the date of every word', () => {
    const wrapper = mount(WordEntry, { props: { item: { ...TOMATO, wordBanks: ['high'] } } })

    // 从词库导入的词优先显示「词库·高频」，而不是笼统的「词库」
    expect(wrapper.get('.entry-source').text()).toBe('词库·高频')
    expect(wrapper.get('.entry-date').text()).toBe('收录 2026-09-01')
    expect(wrapper.get('.status-pill').text()).toContain('复习中')
  })

  it('should mark manual words without phonetics or bank labels', () => {
    const wrapper = mount(WordEntry, {
      props: {
        item: {
          ...TOMATO,
          word: 'story',
          source: 'manual',
          cocaRank: null,
          dictionaryId: null,
          phonetic: null,
          senses: [{ pos: '', meaning: '故事' }],
        },
      },
    })

    expect(wrapper.get('.entry-source').text()).toBe('手填')
    expect(wrapper.get('.entry-phonetic').text()).toBe('—')
  })

  it('should emit open when the word is clicked', async () => {
    const wrapper = mount(WordEntry, { props: { item: TOMATO } })

    await wrapper.get('.entry-word').trigger('click')

    expect(wrapper.emitted('open')).toEqual([[TOMATO]])
  })

  it('should emit select with the checkbox state', async () => {
    const wrapper = mount(WordEntry, { props: { item: TOMATO, selectable: true } })

    await wrapper.get('input[type="checkbox"]').setValue(true)

    expect(wrapper.emitted('select')).toEqual([[{ id: 'w1', selected: true }]])
  })

  it('should expose edit and delete from the entry menu', async () => {
    const wrapper = mount(WordEntry, { props: { item: TOMATO } })

    await wrapper.get('.menu-trigger').trigger('click')
    const items = wrapper.findAll('.menu-item')
    expect(items.map((item) => item.text())).toEqual(['编辑', '删除'])

    await items[0].trigger('click')
    expect(wrapper.emitted('edit')).toEqual([[TOMATO]])

    await wrapper.get('.menu-trigger').trigger('click')
    await wrapper.findAll('.menu-item')[1].trigger('click')
    expect(wrapper.emitted('remove')).toEqual([[TOMATO]])
  })
})

describe('WordBook', () => {
  function makeItems(count) {
    return Array.from({ length: count }, (_, index) => ({
      id: `w${index + 1}`,
      word: `word${index + 1}`,
      studyState: 'reviewing',
      reviewStage: 0,
      createdAt: '2026-09-01T08:00:00.000Z',
      source: 'manual',
      phonetic: null,
      senses: [{ pos: '', meaning: '释义' }],
      wordBanks: [],
    }))
  }

  it('should split one spread into two pages of six entries', () => {
    const wrapper = mount(WordBook, {
      props: { items: makeItems(12), total: 24, page: 1, pageSize: 12 },
    })

    expect(wrapper.get('.book-page--left').findAll('.word-entry')).toHaveLength(6)
    expect(wrapper.get('.book-page--right').findAll('.word-entry')).toHaveLength(6)
    expect(wrapper.get('.book-page--left').text()).toContain('第 1 页')
    expect(wrapper.get('.book-page--right').text()).toContain('第 2 页')
    expect(wrapper.get('.book-page--left').text()).toContain('1 / 4')
  })

  it('should emit prev and next from the page corners', async () => {
    const wrapper = mount(WordBook, {
      props: { items: makeItems(12), total: 24, page: 2, pageSize: 12 },
    })

    await wrapper.get('.book-page--left .page-corner').trigger('click')
    await wrapper.get('.book-page--right .page-corner').trigger('click')

    expect(wrapper.emitted('prev')).toHaveLength(1)
    expect(wrapper.emitted('next')).toBeUndefined()

    await wrapper.setProps({ total: 36 })
    await wrapper.get('.book-page--right .page-corner').trigger('click')
    expect(wrapper.emitted('next')).toHaveLength(1)
  })

  it('should turn pages with the arrow keys while focus is not in a field', async () => {
    const wrapper = mount(WordBook, {
      props: { items: makeItems(12), total: 24, page: 2, pageSize: 12 },
    })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('prev')).toHaveLength(1)
    expect(wrapper.emitted('next')).toBeUndefined()

    wrapper.unmount()
  })

  it('should show a blank page when the spread has fewer than twelve entries', () => {
    const wrapper = mount(WordBook, {
      props: { items: makeItems(5), total: 5, page: 1, pageSize: 12 },
    })

    expect(wrapper.get('.book-page--left').findAll('.word-entry')).toHaveLength(5)
    expect(wrapper.get('.book-page--right').findAll('.word-entry')).toHaveLength(0)
    expect(wrapper.get('.page-blank').text()).toBe('这一页还空着')
  })

  it('should render the collage grid as a flat list', () => {
    const wrapper = mount(WordBook, {
      props: { items: makeItems(12), total: 12, page: 1, pageSize: 12, mode: 'collage' },
    })

    expect(wrapper.find('.book-spread').exists()).toBe(false)
    expect(wrapper.findAll('.collage .word-entry')).toHaveLength(12)
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
