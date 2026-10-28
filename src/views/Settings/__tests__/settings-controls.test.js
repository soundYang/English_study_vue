/**
 * 阅读设置控件测试
 * 覆盖难度整卡的单选与方向键、长度步进器的边界、题目数量分段控件的取值。
 */
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import DifficultyPicker from '../component/DifficultyPicker.vue'
import LengthPicker from '../component/LengthPicker.vue'
import QuestionCountPicker from '../component/QuestionCountPicker.vue'
import ScopePicker from '../component/ScopePicker.vue'

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
    const wrapper = mount(LengthPicker, { props: { modelValue: 120 } })

    await wrapper.get('[aria-label="增加 10 词"]').trigger('click')
    await wrapper.get('[aria-label="减少 10 词"]').trigger('click')

    // 组件内部记住上一次的结果：先加后减回到 120，而不是拿未更新的 props 再减一次
    const events = wrapper.emitted('update:modelValue')
    expect(events[0]).toEqual([130])
    expect(events[1]).toEqual([120])
  })

  it('should accept a typed word count and round it to the nearest ten', async () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 100 } })
    const input = wrapper.get('.value-input')

    await input.setValue('235')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')).toEqual([[240]])
    expect(input.element.value).toBe('240')
  })

  it('should clamp a typed value to the current level max', async () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 100, max: 300 } })
    const input = wrapper.get('.value-input')

    await input.setValue('999')
    await input.trigger('blur')

    expect(wrapper.emitted('update:modelValue')).toEqual([[300]])
    expect(input.element.value).toBe('300')
  })

  it('should fall back to the current value when the input is empty', async () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 150 } })
    const input = wrapper.get('.value-input')

    await input.setValue('')
    await input.trigger('blur')
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(input.element.value).toBe('150')
  })

  it('should keep only digits while typing', async () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 100 } })
    const input = wrapper.get('.value-input')

    await input.setValue('12a0')

    expect(input.element.value).toBe('120')
  })

  it('should step with arrow keys and keep the input in sync', async () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 100 } })

    await wrapper.get('.value-input').trigger('focus')
    await wrapper.get('.value-input').trigger('keydown', { key: 'ArrowUp' })

    expect(wrapper.emitted('update:modelValue')).toEqual([[110]])
    expect(wrapper.get('.value-input').element.value).toBe('110')
  })

  it('should cancel the typed value on Escape', async () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 100 } })
    const input = wrapper.get('.value-input')

    await input.setValue('320')
    await input.trigger('keydown', { key: 'Escape' })
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(input.element.value).toBe('100')
  })

  it('should prevent Enter from submitting the surrounding form', async () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 100 }, attachTo: document.body })
    const input = wrapper.get('.value-input')
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })

    await input.setValue('180')
    input.element.dispatchEvent(event)
    await nextTick()

    // 设置页用 <form @submit.prevent> 触发生成，不拦回车会直接开始生成
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toEqual([[180]])
    wrapper.unmount()
  })

  it('should apply a preset when an inactive pill is clicked', async () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 100 } })

    await wrapper.get('[aria-label="选择约 200 词"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')[0]).toEqual([200])
  })

  it('should clamp the stepper at the backend minimum', () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 100 } })

    expect(wrapper.get('[aria-label="减少 10 词"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="增加 10 词"]').attributes('disabled')).toBeUndefined()
  })

  it('should disable the increase button at the upper bound', () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 600 } })

    expect(wrapper.get('[aria-label="增加 10 词"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="减少 10 词"]').attributes('disabled')).toBeUndefined()
  })

  it('should respect the per-level max', () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 300, max: 300 } })

    expect(wrapper.get('[aria-label="增加 10 词"]').attributes('disabled')).toBeDefined()
  })

  it('should grey out presets above the per-level max', () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 100, max: 150 } })

    expect(wrapper.get('[aria-label="选择约 200 词"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="选择约 150 词"]').attributes('disabled')).toBeUndefined()
  })
})

describe('ScopePicker', () => {
  it('should render the three scopes with all selected by default', () => {
    const wrapper = mount(ScopePicker, { props: { modelValue: ['all'] } })
    const chips = wrapper.findAll('[role="checkbox"]')

    expect(chips).toHaveLength(3)
    expect(chips.map((chip) => chip.text())).toEqual(['今天新学', '今天复习', '全部词汇'])
    expect(chips[0].attributes('aria-checked')).toBe('false')
    expect(chips[2].attributes('aria-checked')).toBe('true')
  })

  it('should pick a concrete scope without the all option', async () => {
    const wrapper = mount(ScopePicker, { props: { modelValue: ['all'] } })

    await wrapper.findAll('[role="checkbox"]')[0].trigger('click')

    expect(wrapper.emitted('update:modelValue')[0]).toEqual([['today_new']])
  })

  it('should add a second concrete scope to the union', async () => {
    const wrapper = mount(ScopePicker, { props: { modelValue: ['today_new'] } })

    await wrapper.findAll('[role="checkbox"]')[1].trigger('click')

    expect(wrapper.emitted('update:modelValue')[0]).toEqual([['today_new', 'today_reviewed']])
  })

  it('should fall back to all when the last concrete scope is removed', async () => {
    const wrapper = mount(ScopePicker, { props: { modelValue: ['today_new'] } })

    await wrapper.findAll('[role="checkbox"]')[0].trigger('click')

    // 后端不接受空数组，前端干脆不让出现这种情况
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([['all']])
  })

  it('should not emit when disabled', async () => {
    const wrapper = mount(ScopePicker, { props: { modelValue: ['all'], disabled: true } })

    await wrapper.findAll('[role="checkbox"]')[0].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
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
