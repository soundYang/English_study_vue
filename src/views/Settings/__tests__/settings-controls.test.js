/**
 * 阅读设置控件测试
 * 覆盖难度整卡的单选与方向键、长度步进器的边界、题目数量分段控件的取值。
 */
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import AllowNewWordsPicker from '../component/AllowNewWordsPicker.vue'
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

  it('should keep the illustration non-interactive so taps select the card', async () => {
    // 手机上点图会落到整卡按钮上：图片不参与拖动 / 长按，避免浏览器把它当「看图」全屏预览
    const wrapper = mount(DifficultyPicker, { props: { modelValue: 'easy' } })
    const image = wrapper.findAll('[role="radio"]')[1].get('img')

    expect(image.attributes('draggable')).toBe('false')

    await image.trigger('click')

    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['medium'])
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

  it('should update the value from the horizontal slider', async () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 100, max: 300 } })
    const slider = wrapper.get('.slider-input')

    await slider.setValue('250')

    expect(wrapper.emitted('update:modelValue')).toEqual([[250]])
    expect(wrapper.get('.value-input').element.value).toBe('250')
    expect(slider.attributes('max')).toBe('300')
  })

  it('should fill the slider track proportionally', () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 350, max: 600 } })

    expect(wrapper.get('.slider-input').attributes('style')).toContain('--fill: 50%')
  })

  it('should disable the slider while generating', () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 150, disabled: true } })

    expect(wrapper.get('.slider-input').attributes('disabled')).toBeDefined()
  })

  it('should clamp the stepper at the backend minimum', () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 100 } })

    expect(wrapper.get('[aria-label="减少 10 词"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="增加 10 词"]').attributes('disabled')).toBeUndefined()
  })

  it('should disable the increase button at the upper bound', () => {
    // 契约上限已是 1000（最终模式），600 只是 hard 的常规上限
    const wrapper = mount(LengthPicker, { props: { modelValue: 1000, max: 1000 } })

    expect(wrapper.get('[aria-label="增加 10 词"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="减少 10 词"]').attributes('disabled')).toBeUndefined()
  })

  it('should respect the per-level max', () => {
    const wrapper = mount(LengthPicker, { props: { modelValue: 300, max: 300 } })

    expect(wrapper.get('[aria-label="增加 10 词"]').attributes('disabled')).toBeDefined()
  })

  it('should draw the locked final-mode segment above the level cap', () => {
    const wrapper = mount(LengthPicker, {
      props: {
        modelValue: 600,
        max: 600,
        finalMode: {
          supported: true,
          unlocked: false,
          unlockAt: 3000,
          shortage: 2980,
          maxTargetWords: 1000,
        },
      },
    })
    const bounds = wrapper.findAll('.slider-bound')

    // 滑杆画到 1000，但可拖的上限仍是 600
    expect(wrapper.get('.slider-input').attributes('max')).toBe('600')
    expect(bounds[bounds.length - 1].text()).toBe('1000')
    expect(wrapper.get('.slider-locked').text()).toBe('最终模式')
    expect(wrapper.get('.final-note').text()).toContain('还差 2980 个')
  })

  it('should merge the unlocked final-mode range into the slider', () => {
    const wrapper = mount(LengthPicker, {
      props: {
        modelValue: 800,
        max: 1000,
        finalMode: {
          supported: true,
          unlocked: true,
          unlockAt: 3000,
          shortage: 0,
          maxTargetWords: 1000,
        },
      },
    })

    expect(wrapper.find('.slider-locked').exists()).toBe(false)
    expect(wrapper.get('.slider-input').attributes('max')).toBe('1000')
    expect(wrapper.get('.final-note').text()).toBe('已解锁最终模式：可以写 601–1000 词。')
  })

  it('should hide final mode for levels that do not support it', () => {
    const wrapper = mount(LengthPicker, {
      props: { modelValue: 150, max: 300, finalMode: { supported: false, unlocked: false } },
    })

    expect(wrapper.find('.slider-locked').exists()).toBe(false)
    expect(wrapper.find('.final-note').exists()).toBe(false)
  })
})

describe('ScopePicker', () => {
  it('should render the four scopes with all selected by default', () => {
    const wrapper = mount(ScopePicker, { props: { modelValue: ['all'] } })
    const chips = wrapper.findAll('[role="checkbox"]')

    expect(chips).toHaveLength(4)
    expect(chips.map((chip) => chip.text())).toEqual([
      '今天新学',
      '今天复习过',
      '复习中',
      '全部词汇',
    ])
    expect(chips[0].attributes('aria-checked')).toBe('false')
    expect(chips[3].attributes('aria-checked')).toBe('true')
    // 「复习中」与词汇页同口径，「今天复习过」是日期口径，说明一行要讲清两者
    expect(wrapper.get('.scope-hint').text()).toContain('词汇页')
    expect(wrapper.get('.scope-hint').text()).toContain('今天提交练习后回写')
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

  it('should pick the reviewing scope on its own', async () => {
    const wrapper = mount(ScopePicker, { props: { modelValue: ['all'] } })

    await wrapper.findAll('[role="checkbox"]')[2].trigger('click')

    // md/22 #109：reviewing 与词汇页「复习中」同口径，不是 today_reviewed 的别名
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([['reviewing']])
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

describe('AllowNewWordsPicker', () => {
  it('should start off outside final mode and flip to an explicit true', async () => {
    const wrapper = mount(AllowNewWordsPicker, {
      props: { modelValue: null, budget: 3, autoOn: false },
    })
    const toggle = wrapper.get('[role="switch"]')

    // 自动 + 非最终模式 = 关；但值是 null，还没落成显式 false
    expect(toggle.attributes('aria-checked')).toBe('false')
    expect(wrapper.text()).toContain('只用你认识的词')

    await toggle.trigger('click')

    expect(wrapper.emitted('update:modelValue')[0]).toEqual([true])
  })

  it('should show on for final mode without writing an explicit value', () => {
    const wrapper = mount(AllowNewWordsPicker, {
      props: { modelValue: null, budget: 5, autoOn: true },
    })

    expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.text()).toContain('最终模式默认开启')
  })

  it('should let final mode be switched off explicitly', async () => {
    const wrapper = mount(AllowNewWordsPicker, {
      props: { modelValue: null, budget: 5, autoOn: true },
    })

    await wrapper.get('[role="switch"]').trigger('click')

    // 自动默认开，用户关掉要落成显式 false，不能被自动再覆盖回来
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
  })

  it('should keep an explicit false even when final mode would default on', () => {
    const wrapper = mount(AllowNewWordsPicker, {
      props: { modelValue: false, budget: 5, autoOn: true },
    })

    expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  it('should describe the budget as an upper bound only', () => {
    const wrapper = mount(AllowNewWordsPicker, {
      props: { modelValue: true, budget: 3, autoOn: false },
    })

    expect(wrapper.text()).toContain('最多 3 个生词')
    expect(wrapper.text()).toContain('不保证出现')
  })

  it('should not emit when disabled', async () => {
    const wrapper = mount(AllowNewWordsPicker, {
      props: { modelValue: null, budget: 3, autoOn: false, disabled: true },
    })

    await wrapper.get('[role="switch"]').trigger('click')

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
