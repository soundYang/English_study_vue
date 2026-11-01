/**
 * 今日复习入口条测试
 * 覆盖三态：有到期词（带按钮）、今天已复习完（完成态、无按钮）、未加载 / 无记录（不渲染）；
 * 以及 remaining > today 时的顺延提示（md/56 P1）。
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ReviewBanner from '../component/ReviewBanner.vue'

async function mountBanner(props) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/words', name: 'words', component: { template: '<div />' } },
      { path: '/words/review', name: 'words-review', component: { template: '<div />' } },
    ],
  })
  await router.push('/words')
  await router.isReady()

  const wrapper = mount(ReviewBanner, {
    props,
    global: { plugins: [router] },
  })
  return { wrapper, router }
}

describe('ReviewBanner', () => {
  it('should show the pending count and link to the review page', async () => {
    const { wrapper } = await mountBanner({ remaining: 5, today: 5, done: 2 })

    expect(wrapper.get('.banner-title').text()).toBe('今天有 5 个单词到期待复习')
    expect(wrapper.get('.banner-meta').text()).toBe('今天已完成 2 次')

    const action = wrapper.get('.banner-action')
    expect(action.text()).toContain('开始复习')
    expect(action.attributes('href')).toBe('/words/review')
    expect(wrapper.find('.banner-hint').exists()).toBe(false)
  })

  it('should hint that the rest rolls over when the backlog exceeds today', async () => {
    const { wrapper } = await mountBanner({ remaining: 70, today: 50, done: 0 })

    expect(wrapper.get('.banner-hint').text()).toBe('今天先复习 50 个，剩下的顺延到明天。')
  })

  it('should show the done state without an action when nothing is due', async () => {
    const { wrapper } = await mountBanner({ remaining: 0, today: 0, done: 3 })

    expect(wrapper.classes()).toContain('is-done')
    expect(wrapper.get('.banner-title').text()).toBe('今天的复习完成了')
    expect(wrapper.get('.banner-meta').text()).toContain('今天复习了 3 次')
    expect(wrapper.find('.banner-action').exists()).toBe(false)
  })

  it('should stay hidden before loading or when there is nothing to report', async () => {
    expect((await mountBanner({ remaining: null })).wrapper.find('.review-banner').exists()).toBe(
      false,
    )
    expect(
      (await mountBanner({ remaining: 0, today: 0, done: 0 })).wrapper
        .find('.review-banner')
        .exists(),
    ).toBe(false)
  })
})
