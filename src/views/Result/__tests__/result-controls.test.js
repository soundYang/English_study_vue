/**
 * 结果页展示组件测试
 * 覆盖成绩摘要、单题解析与翻译折叠的渲染、状态与交互。
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import QuestionReview from '../component/QuestionReview.vue'
import ScoreSummary from '../component/ScoreSummary.vue'
import TranslationPanel from '../component/TranslationPanel.vue'

const QUESTION = {
  id: 4,
  question: 'Who sometimes joins him?',
  options: ['His brother', 'A friend', 'A teacher', 'A neighbor'],
}

describe('ScoreSummary', () => {
  it('should render the score, percentage and tier copy', () => {
    const wrapper = mount(ScoreSummary, {
      props: {
        score: 80,
        correctCount: 4,
        totalQuestions: 5,
        duration: 0,
      },
    })

    expect(wrapper.get('.ring-fraction').text()).toBe('4 / 5')
    expect(wrapper.get('.ring-percent').text()).toBe('80%')
    expect(wrapper.text()).toContain('很不错！再巩固一下错题就更稳了。')
    expect(wrapper.get('.ring').attributes('aria-label')).toBe('得分 4 / 5，正确率 80%')
    expect(wrapper.classes()).toContain('is-good')
  })

  it('should use the success tone at 100 and the warning tone below 60', () => {
    const perfect = mount(ScoreSummary, {
      props: { score: 100, correctCount: 5, totalQuestions: 5, duration: 0 },
    })
    expect(perfect.classes()).toContain('is-perfect')
    expect(perfect.text()).toContain('太棒了！你已经完全掌握了这篇文章的内容！')

    const low = mount(ScoreSummary, {
      props: { score: 40, correctCount: 2, totalQuestions: 5, duration: 0 },
    })
    expect(low.classes()).toContain('is-low')
    expect(low.text()).toContain('别灰心，把文章再读一遍，明天再试一次。')
  })

  it('should emit retry, home and history', async () => {
    const wrapper = mount(ScoreSummary, {
      props: { score: 80, correctCount: 4, totalQuestions: 5, duration: 0 },
    })

    const buttons = wrapper.findAll('button')
    await buttons.find((button) => button.text().includes('再练一次')).trigger('click')
    await buttons.find((button) => button.text().includes('返回首页')).trigger('click')
    await buttons.find((button) => button.text().includes('查看历史')).trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(1)
    expect(wrapper.emitted('home')).toHaveLength(1)
    expect(wrapper.emitted('history')).toHaveLength(1)
  })
})

describe('QuestionReview', () => {
  const correctResult = {
    questionId: 4,
    selectedOption: 1,
    correctAnswer: 1,
    isCorrect: true,
    explanation: 'Sometimes a friend joins him.',
  }

  it('should show a correct answer without repeating the correct line', () => {
    const wrapper = mount(QuestionReview, {
      props: { question: QUESTION, result: correctResult, index: 0 },
    })

    expect(wrapper.text()).toContain('回答正确')
    expect(wrapper.get('.answer-value').text()).toBe('B. A friend')
    expect(wrapper.text()).not.toContain('正确答案：')
    expect(wrapper.get('.review-explanation').text()).toBe('Sometimes a friend joins him.')
    expect(wrapper.classes()).not.toContain('is-wrong')
  })

  it('should show the selected and correct answers for a wrong response', () => {
    const wrapper = mount(QuestionReview, {
      props: {
        question: QUESTION,
        result: {
          questionId: 4,
          selectedOption: 3,
          correctAnswer: 1,
          isCorrect: false,
          explanation: 'Sometimes a friend joins him.',
        },
        index: 3,
      },
    })

    expect(wrapper.text()).toContain('回答错误')
    expect(wrapper.findAll('.answer-value')[0].text()).toBe('D. A neighbor')
    expect(wrapper.get('.is-correct-answer .answer-value').text()).toBe('B. A friend')
    expect(wrapper.classes()).toContain('is-wrong')
    expect(wrapper.attributes('style')).toContain('animation-delay: 120ms')
  })

  it('should render unanswered and skip an empty explanation', () => {
    const wrapper = mount(QuestionReview, {
      props: {
        question: QUESTION,
        result: {
          questionId: 4,
          selectedOption: null,
          correctAnswer: 1,
          isCorrect: false,
          explanation: '',
        },
        index: 0,
      },
    })

    expect(wrapper.get('.answer-value').text()).toBe('未作答')
    expect(wrapper.get('.answer-value').classes()).toContain('is-empty')
    expect(wrapper.find('.review-explanation').exists()).toBe(false)
  })
})

describe('TranslationPanel', () => {
  it('should collapse and expand a long translation', async () => {
    const translation = '这是一段用于测试折叠效果的中文翻译。'.repeat(20)
    const wrapper = mount(TranslationPanel, { props: { translation } })

    const toggle = wrapper.get('.translation-toggle')
    expect(toggle.text()).toContain('收起翻译')
    expect(toggle.attributes('aria-expanded')).toBe('true')

    await toggle.trigger('click')

    expect(wrapper.get('.translation-toggle').text()).toContain('展开翻译')
    expect(wrapper.get('.translation-toggle').attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('.translation-text').text()).toBe(translation)
    expect(wrapper.get('.translation-body').classes()).toContain('is-collapsed')
  })

  it('should hide the toggle for a short translation', () => {
    const wrapper = mount(TranslationPanel, { props: { translation: '很短的一段翻译。' } })

    expect(wrapper.find('.translation-toggle').exists()).toBe(false)
    expect(wrapper.get('.translation-text').text()).toBe('很短的一段翻译。')
  })
})
