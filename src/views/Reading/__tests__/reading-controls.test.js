/**
 * 阅读答题控件测试
 * 覆盖顶部计时/进度/跳转/退出，以及题卡的选择、已作答与禁用状态。
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
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
