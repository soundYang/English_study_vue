/**
 * 阅读设置控件测试
 * 覆盖难度整卡的单选与方向键、长度步进器的边界、题目数量分段控件的取值。
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DifficultyPicker from '../component/DifficultyPicker.vue'
import LengthPicker from '../component/LengthPicker.vue'
import QuestionCountPicker from '../component/QuestionCountPicker.vue'

describe('DifficultyPicker', () => {
  it('should mark the current level and emit the clicked one', async () => {
    const wrapper = mount(DifficultyPicker, { props: { modelValue: 'easy' } })
    const radios = wrapper.findAll('[role="radio"]')

    expect(radios).toHaveLength(3)
    expect(radios[0].attributes('aria-checked')).toBe('true')
    expect(radios[0].attributes('aria-label')).toContain('简单')

    await radios[1].trigger('click')

    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['medium'])
  })

  it('should move selection with arrow keys', async () => {
    const wrapper = mount(DifficultyPicker, { props: { modelValue: 'easy' } })

    await wrapper.get('[role="radiogroup"]').trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['medium'])
  })

  it('should not emit when disabled', async () => {
    const wrapper = mount(DifficultyPicker, {
      props: { modelValue: 'easy', disabled: true },
    })

    await wrapper.findAll('[role="radio"]')[2].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('LengthPicker', () => {
  it('should step by 10 words inside the active pill', async () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 100 } })

    await wrapper.get('[aria-label="增加 10 词"]').trigger('click')
    await wrapper.get('[aria-label="减少 10 词"]').trigger('click')

    const events = wrapper.emitted('update:modelValue')
    expect(events[0]).toEqual([110])
    expect(events[1]).toEqual([90])
  })

  it('should apply a preset when an inactive pill is clicked', async () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 100 } })

    await wrapper.get('[aria-label="选择约 200 词"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')[0]).toEqual([200])
  })

  it('should disable the increase button at the upper bound', () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 300 } })

    expect(wrapper.get('[aria-label="增加 10 词"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="减少 10 词"]').attributes('disabled')).toBeUndefined()
  })
})

describe('QuestionCountPicker', () => {
  it('should emit the selected question count', async () => {
    const wrapper = mount(QuestionCountPicker, { props: { modelValue: 5 } })
    const options = wrapper.findAll('[role="radio"]')

    expect(options).toHaveLength(3)
    expect(options[1].attributes('aria-checked')).toBe('true')

    await options[2].trigger('click')

    expect(wrapper.emitted('update:modelValue')[0]).toEqual([8])
  })
})
