/**
 * 基础词卡片测试
 * 覆盖四个槽位的内容切换（基础词 / 功能词 / 日期词 / 缩写）、三态状态文案，
 * 以及操作菜单的各种形态：未标记、已标不认识、已标认识、已在个人词库（禁用项）。
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
    personalState: 'untouched',
    knownSource: null,
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

function menuLabels(wrapper) {
  return wrapper.findAll('[role="menuitem"]').map((node) => node.text())
}

describe('WordCard · 内容槽位', () => {
  it('should render the word, both phonetics, the meaning and the status', () => {
    const wrapper = mount(WordCard, { props: { item: makeItem() } })

    expect(wrapper.get('.card-word').text()).toBe('abandon')
    expect(wrapper.get('.is-phonetic').findAll('.phonetic-part')).toHaveLength(2)
    expect(wrapper.get('.is-meaning').text()).toBe('放弃；抛弃')
    expect(wrapper.get('.card-foot').text()).toContain('未标记')
  })

  it('should give every card a type badge, starting with 基础词', () => {
    const wrapper = mount(WordCard, { props: { item: makeItem() } })

    expect(wrapper.get('.card-meta').text()).toBe('基础词')
    expect(wrapper.find('.card-meta-space').exists()).toBe(false)
  })

  it('should show 日期词 for a calendar word', () => {
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

    expect(wrapper.get('.card-meta').text()).toBe('日期词')
    expect(wrapper.get('.card-meta').attributes('title')).toContain('星期')
  })

  it('should show 功能词 for a function word', () => {
    const wrapper = mount(WordCard, {
      props: { item: makeItem({ word: 'the', isFunctionWord: true, removable: false }) },
    })

    expect(wrapper.get('.card-meta').text()).toBe('功能词')
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

  it('should show the three personal states from personalState', () => {
    const untouched = mount(WordCard, { props: { item: makeItem() } })
    const known = mount(WordCard, {
      props: { item: makeItem({ personalState: 'known', knownSource: 'mark' }) },
    })
    const removed = mount(WordCard, { props: { item: makeItem({ personalState: 'removed' }) } })

    expect(untouched.get('.card-foot').text()).toContain('未标记')
    expect(known.get('.card-foot').text()).toContain('认识')
    expect(removed.get('.card-foot').text()).toContain('不认识')
  })
})

describe('WordCard · 详情入口', () => {
  it('should emit detail with the button as anchor when the word is clicked', async () => {
    const item = makeItem()
    const wrapper = mount(WordCard, { props: { item } })

    await wrapper.get('.card-word-button').trigger('click')

    const [[payload]] = wrapper.emitted('detail')
    expect(payload.item).toEqual(item)
    expect(payload.anchor).toBe(wrapper.get('.card-word-button').element)
  })

  it('should reflect the open state on the trigger', () => {
    const wrapper = mount(WordCard, { props: { item: makeItem(), expanded: true } })
    const trigger = wrapper.get('.card-word-button')

    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(trigger.attributes('aria-haspopup')).toBe('dialog')
    expect(wrapper.get('.word-card').classes()).toContain('is-expanded')
  })

  it('should not open the detail from the menu trigger', async () => {
    const wrapper = mount(WordCard, { props: { item: makeItem() } })

    await wrapper.get('.menu-trigger').trigger('click')

    expect(wrapper.emitted('detail')).toBeUndefined()
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
  })
})

describe('WordCard · 操作菜单', () => {
  it('should hide the menu on a read-only word', () => {
    const wrapper = mount(WordCard, {
      props: { item: makeItem({ removable: false }) },
    })

    expect(wrapper.find('.menu-trigger').exists()).toBe(false)
  })

  it('should offer both marks for an untouched word', async () => {
    const item = makeItem()
    const wrapper = mount(WordCard, { props: { item } })

    await openMenu(wrapper)
    expect(menuLabels(wrapper)).toEqual(['标为认识', '标为不认识'])

    await wrapper.findAll('[role="menuitem"]')[1].trigger('click')

    expect(wrapper.emitted('select')).toEqual([[{ item, type: 'unknown' }]])
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('should emit known when 标为认识 is chosen', async () => {
    const item = makeItem()
    const wrapper = mount(WordCard, { props: { item } })

    await openMenu(wrapper)
    await wrapper.findAll('[role="menuitem"]')[0].trigger('click')

    expect(wrapper.emitted('select')).toEqual([[{ item, type: 'known' }]])
  })

  it('should offer 标为认识 and 取消标记 for a removed word', async () => {
    const item = makeItem({ personalState: 'removed' })
    const wrapper = mount(WordCard, { props: { item } })

    await openMenu(wrapper)
    expect(menuLabels(wrapper)).toEqual(['标为认识', '取消标记'])

    await wrapper.findAll('[role="menuitem"]')[1].trigger('click')

    expect(wrapper.emitted('select')).toEqual([[{ item, type: 'none' }]])
  })

  it('should offer 标为不认识 and 取消认识 for a word marked as known', async () => {
    const item = makeItem({ personalState: 'known', knownSource: 'mark' })
    const wrapper = mount(WordCard, { props: { item } })

    await openMenu(wrapper)
    expect(menuLabels(wrapper)).toEqual(['标为不认识', '取消认识'])

    await wrapper.findAll('[role="menuitem"]')[1].trigger('click')

    expect(wrapper.emitted('select')).toEqual([[{ item, type: 'none' }]])
  })

  it('should open a disabled explanation for a word already in my list', async () => {
    const wrapper = mount(WordCard, {
      props: {
        item: makeItem({
          personalState: 'known',
          knownSource: 'library',
          personalStatus: 'learning',
        }),
      },
    })

    const menu = await openMenu(wrapper)
    const action = menu.get('[role="menuitem"]')

    expect(action.text()).toContain('已在词库中')
    expect(action.element.disabled).toBe(true)

    await action.trigger('click')

    expect(wrapper.emitted('select')).toBeUndefined()
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
