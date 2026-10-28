/**
 * 阅读答题控件测试
 * 覆盖顶部计时/进度/跳转/退出，以及题卡的选择、已作答与禁用状态。
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ArticleCard from '../component/ArticleCard.vue'
import NewWordsPanel from '../component/NewWordsPanel.vue'
import ReadingHeader from '../component/ReadingHeader.vue'
import QuestionCard from '../component/QuestionCard.vue'

const QUESTIONS = [
  { id: 1, question: 'Question one', options: ['A', 'B', 'C', 'D'] },
  { id: 2, question: 'Question two', options: ['A', 'B', 'C', 'D'] },
  { id: 3, question: 'Question three', options: ['A', 'B', 'C', 'D'] },
]

describe('ReadingHeader', () => {
  it('should show the clock, progress and answered segments', () => {
    const wrapper = mount(ReadingHeader, {
      props: {
        remaining: 59,
        level: 'hard',
        current: 2,
        total: 3,
        questions: QUESTIONS,
        answeredIds: [1],
      },
    })

    expect(wrapper.get('.timer-text').text()).toBe('00:59')
    expect(wrapper.get('.timer-pill').classes()).toContain('is-urgent')
    expect(wrapper.text()).toContain('第 2 题 / 共 3 题')
    expect(wrapper.findAll('.progress-segment')).toHaveLength(3)
    expect(wrapper.findAll('.progress-segment')[0].classes()).toContain('is-answered')
    expect(wrapper.findAll('.progress-segment')[1].classes()).toContain('is-active')
  })

  it('should mark the finished timer and emit jump and exit', async () => {
    const wrapper = mount(ReadingHeader, {
      props: {
        remaining: 0,
        current: 1,
        total: 3,
        questions: QUESTIONS,
      },
    })

    expect(wrapper.get('.timer-text').text()).toBe('00:00')
    expect(wrapper.get('.timer-pill').classes()).toContain('is-finished')

    await wrapper.get('[aria-label="跳到第 3 题"]').trigger('click')
    expect(wrapper.emitted('jump')).toEqual([[3]])

    await wrapper.get('[aria-label="退出本次练习"]').trigger('click')
    expect(wrapper.emitted('exit')).toHaveLength(1)
  })

  it('should disable navigation while submitting', async () => {
    const wrapper = mount(ReadingHeader, {
      props: {
        remaining: 900,
        current: 1,
        total: 3,
        questions: QUESTIONS,
        disabled: true,
      },
    })

    const segment = wrapper.get('[aria-label="跳到第 2 题"]')
    expect(segment.attributes('disabled')).toBeDefined()
    await segment.trigger('click')
    expect(wrapper.emitted('jump')).toBeUndefined()
  })
})

describe('ArticleCard', () => {
  const ARTICLE = 'A quiet start.\n\nNothing dramatic happened.'
  const DRAMATIC = { word: 'dramatic', senses: [{ pos: 'adj.', meaning: '戏剧性的' }] }

  it('should render plain text when no new words are passed', () => {
    const wrapper = mount(ArticleCard, { props: { title: 'Story', article: ARTICLE } })

    expect(wrapper.findAll('.article-paragraph')).toHaveLength(2)
    expect(wrapper.find('.article-new-word').exists()).toBe(false)
    expect(wrapper.text()).toContain('Nothing dramatic happened.')
  })

  it('should mark the new word and emit it with the button as the anchor', async () => {
    const wrapper = mount(ArticleCard, {
      props: { title: 'Story', article: ARTICLE, highlightWords: [DRAMATIC] },
    })
    const trigger = wrapper.get('.article-new-word')

    expect(trigger.text()).toBe('dramatic')
    expect(wrapper.text()).toContain('Nothing dramatic happened.')

    await trigger.trigger('click')

    const [[payload]] = wrapper.emitted('word-click')
    expect(payload.entry).toEqual(DRAMATIC)
    expect(payload.anchor).toBe(trigger.element)
  })

  it('should keep the meta slot in the title row and hide the row without content', () => {
    const withSlot = mount(ArticleCard, {
      props: { title: 'Story', article: ARTICLE, wordCount: 40 },
      slots: { meta: '<span class="test-meta">本文含 1 个未学单词</span>' },
    })
    const bare = mount(ArticleCard, { props: { title: 'Story', article: ARTICLE } })

    expect(withSlot.get('.article-head').text()).toContain('40 词')
    expect(withSlot.get('.article-head').text()).toContain('本文含 1 个未学单词')
    expect(bare.find('.article-meta-row').exists()).toBe(false)
  })
})

describe('NewWordsPanel', () => {
  const WORDS = [
    { word: 'dramatic', phonetic: { uk: '/drəˈmæt.ɪk/' }, senses: [{ meaning: '戏剧性的' }] },
    { word: 'USA', phonetic: { uk: '/ˌjuː.esˈeɪ/' }, senses: [], source: 'abbreviation' },
  ]

  it('should stay collapsed and expand itself without a v-model', async () => {
    const wrapper = mount(NewWordsPanel, { props: { words: WORDS } })

    expect(wrapper.get('.new-words-toggle').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.new-words-list').exists()).toBe(false)

    await wrapper.get('.new-words-toggle').trigger('click')

    expect(wrapper.emitted('update:open')).toEqual([[true]])
    // 没绑 v-model 时（结果页）靠组件内部状态展开，不能变成点不动的死按钮
    expect(wrapper.get('.new-words-toggle').attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('.new-word')).toHaveLength(2)
  })

  it('should follow the open prop when the page controls it', async () => {
    const wrapper = mount(NewWordsPanel, { props: { words: WORDS, open: false } })

    await wrapper.setProps({ open: true })
    expect(wrapper.findAll('.new-word')).toHaveLength(2)

    await wrapper.setProps({ open: false })
    expect(wrapper.find('.new-words-list').exists()).toBe(false)
  })

  it('should list the words when open and hide the abbreviation fragments', () => {
    const wrapper = mount(NewWordsPanel, { props: { words: WORDS, open: true } })
    const items = wrapper.findAll('.new-word')

    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('/drəˈmæt.ɪk/')
    expect(items[0].text()).toContain('戏剧性的')
    // 缩写只留原词，不显示音标与碎片释义
    expect(items[1].text()).toBe('USA')
  })

  it('should not render anything without words', () => {
    const wrapper = mount(NewWordsPanel, { props: { words: [] } })

    expect(wrapper.find('.new-words').exists()).toBe(false)
  })
})

describe('QuestionCard', () => {
  const question = {
    id: 7,
    question: 'What is the main idea?',
    options: ['First', 'Second', 'Third', 'Fourth'],
  }

  it('should emit the option index when selected', async () => {
    const wrapper = mount(QuestionCard, {
      props: { question, index: 0, selected: null },
    })

    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios).toHaveLength(4)

    await radios[2].setChecked()

    expect(wrapper.emitted('select')).toEqual([[2]])
  })

  it('should show the selected option and the answered dot', () => {
    const wrapper = mount(QuestionCard, {
      props: { question, index: 1, selected: 2 },
    })

    const options = wrapper.findAll('.option')
    expect(options).toHaveLength(4)
    expect(options[2].classes()).toContain('is-selected')
    expect(wrapper.find('.answered-dot').exists()).toBe(true)
    expect(wrapper.get('.answered-dot').text()).toBe('已作答')
    expect(wrapper.get('.question-number').text()).toBe('2')
  })

  it('should not emit when disabled', async () => {
    const wrapper = mount(QuestionCard, {
      props: { question, index: 0, selected: null, disabled: true },
    })

    await wrapper.findAll('input[type="radio"]')[0].trigger('change')

    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
  })
})
