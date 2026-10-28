/**
 * 基础词卡片测试
 * 覆盖四个槽位的内容切换（实词 / 功能词 / 日历词 / 缩写）、状态文案，
 * 以及操作菜单的三种形态：可移除、可恢复、已在个人词库（禁用项）。
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WordCard from '../component/WordCard.vue'

function makeItem(overrides = {}) {
  return {
    word: 'abandon',
    kinds: ['basic'],
    kind: 'basic',
    isFunctionWord: false,
    removable: true,
    removed: false,
    personalStatus: null,
    wordId: null,
    cocaRank: 2201,
    phonetic: { uk: '/əˈbæn.dən/', us: '/əˈbæn.dɑːn/' },
    senses: [{ pos: 'v.', meaning: '放弃；抛弃' }],
    summary: '放弃；抛弃',
    expansion: null,
    expansionMeaning: null,
    calendarType: null,
    ...overrides,
  }
}

async function openMenu(wrapper) {
  await wrapper.get('.menu-trigger').trigger('click')
  return wrapper.get('[role="menu"]')
}

describe('WordCard · 内容槽位', () => {
  it('should render the word, both phonetics, the meaning and the status', () => {
    const wrapper = mount(WordCard, { props: { item: makeItem() } })

    expect(wrapper.get('.card-word').text()).toBe('abandon')
    expect(wrapper.get('.is-phonetic').findAll('.phonetic-part')).toHaveLength(2)
    expect(wrapper.get('.is-meaning').text()).toBe('放弃；抛弃')
    expect(wrapper.get('.card-foot').text()).toContain('未标记')
  })

  it('should show the calendar label for a calendar word', () => {
    const wrapper = mount(WordCard, {
      props: {
        item: makeItem({
          word: 'Monday',
          kinds: ['calendar'],
          kind: 'calendar',
          calendarType: 'weekday',
          phonetic: { uk: '/ˈmʌn.deɪ/', us: '/ˈmʌn.deɪ/' },
          summary: '星期一',
        }),
      },
    })

    expect(wrapper.get('.card-meta').text()).toBe('星期')
  })

  it('should show 文章必用 for a function word', () => {
    const wrapper = mount(WordCard, {
      props: { item: makeItem({ word: 'the', isFunctionWord: true, removable: false }) },
    })

    expect(wrapper.get('.card-meta').text()).toBe('文章必用')
    expect(wrapper.find('.menu-trigger').exists()).toBe(false)
  })

  it('should swap phonetics for the expansion on an abbreviation', () => {
    const wrapper = mount(WordCard, {
      props: {
        item: makeItem({
          word: 'USA',
          kinds: ['abbreviation'],
          kind: 'abbreviation',
          phonetic: null,
          senses: [],
          summary: null,
          expansion: 'United States of America',
          expansionMeaning: '美利坚合众国',
        }),
      },
    })

    expect(wrapper.get('.is-expansion').text()).toBe('United States of America')
    expect(wrapper.get('.is-meaning').text()).toBe('美利坚合众国')
    expect(wrapper.find('.is-phonetic').exists()).toBe(false)
    expect(wrapper.get('.card-meta').text()).toBe('缩写')
  })

  it('should show 不认识 for a removed word', () => {
    const wrapper = mount(WordCard, {
      props: { item: makeItem({ removed: true }) },
    })

    expect(wrapper.get('.card-foot').text()).toContain('不认识')
  })
})

describe('WordCard · 操作菜单', () => {
  it('should hide the menu on a read-only word', () => {
    const wrapper = mount(WordCard, {
      props: { item: makeItem({ removable: false }) },
    })

    expect(wrapper.find('.menu-trigger').exists()).toBe(false)
  })

  it('should emit remove when 标为不认识 is chosen', async () => {
    const item = makeItem()
    const wrapper = mount(WordCard, { props: { item } })

    const menu = await openMenu(wrapper)
    const action = menu.get('[role="menuitem"]')

    expect(action.text()).toBe('标为不认识')
    expect(action.element.disabled).toBe(false)

    await action.trigger('click')

    expect(wrapper.emitted('remove')).toEqual([[item]])
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('should emit restore when 恢复为基础词 is chosen', async () => {
    const item = makeItem({ removed: true })
    const wrapper = mount(WordCard, { props: { item } })

    const menu = await openMenu(wrapper)
    const action = menu.get('[role="menuitem"]')

    expect(action.text()).toBe('恢复为基础词')

    await action.trigger('click')

    expect(wrapper.emitted('restore')).toEqual([[item]])
  })

  it('should open a disabled explanation for a word already in my list', async () => {
    const wrapper = mount(WordCard, {
      props: { item: makeItem({ personalStatus: 'learning', wordId: 'w1' }) },
    })

    const menu = await openMenu(wrapper)
    const action = menu.get('[role="menuitem"]')

    expect(action.text()).toContain('已在词库中')
    expect(action.element.disabled).toBe(true)

    await action.trigger('click')

    expect(wrapper.emitted('remove')).toBeUndefined()
    expect(wrapper.emitted('restore')).toBeUndefined()
  })

  it('should mark the trigger as busy while the write is pending', () => {
    const wrapper = mount(WordCard, { props: { item: makeItem(), pending: true } })
    const trigger = wrapper.get('.menu-trigger')

    expect(trigger.attributes('aria-disabled')).toBe('true')

    return trigger.trigger('click').then(() => {
      expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    })
  })

  it('should close the menu on Escape', async () => {
    const wrapper = mount(WordCard, { props: { item: makeItem() } })

    await openMenu(wrapper)
    await wrapper.get('.card-menu').trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })
})
