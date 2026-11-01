/**
 * 今日复习页测试
 * 覆盖清单渲染、单条「通过 / 没记住」的本地扣减、全部通过、词已删除的提示与完成态；
 * 使用真实 mock adapter（延迟 0），接口口径与后端一致（md/56 §7、§8）。
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ReviewPage from '../index.vue'
import { mockWords, resetMockDb, setMockLatency } from '../../../mock/adapter'
import { useToastStore } from '../../../stores/model/toast'
import { useWordsStore } from '../../../stores/model/words'
import { localStore, storageKeys } from '../../../unit/storage'

let wrapper = null

beforeEach(() => {
  localStorage.clear()
  localStore.set(storageKeys.accessToken, 'sess_review_page')
  resetMockDb()
  setMockLatency(0)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

afterAll(() => {
  setMockLatency(300)
})

async function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/words', name: 'words', component: { template: '<div />' } },
      { path: '/words/review', name: 'words-review', component: ReviewPage },
    ],
  })
  await router.push('/words/review')
  await router.isReady()

  wrapper = mount(ReviewPage, {
    attachTo: document.body,
    global: { plugins: [pinia, router], stubs: { teleport: true } },
  })
  await flushPromises()
  return wrapper
}

function toastMessages() {
  return useToastStore().items.map((item) => item.message)
}

describe('Words review page', () => {
  it('should render the due queue with rounds and summaries', async () => {
    const page = await mountPage()
    const plan = useWordsStore().dailyPlan

    expect(plan.review.words.length).toBeGreaterThan(0)
    expect(page.findAll('.review-row')).toHaveLength(plan.review.words.length)
    expect(page.get('.page-desc').text()).toContain(`待复习 ${plan.review.remaining} 个`)
    expect(page.get('.round-tag').text()).toMatch(/^第 \d+ 轮$/)
    expect(page.get('.word-summary').text()).not.toBe('')
  })

  it('should remove the row and bump progress when passing a word', async () => {
    const page = await mountPage()
    const store = useWordsStore()
    const target = store.dailyPlan.review.words[0]
    const before = {
      rows: page.findAll('.review-row').length,
      done: store.dailyPlan.review.doneToday,
    }

    await page.get(`[aria-label="${target.word} 通过"]`).trigger('click')
    await flushPromises()

    expect(page.findAll('.review-row')).toHaveLength(before.rows - 1)
    expect(page.text()).not.toContain(target.word)
    expect(store.dailyPlan.review.doneToday).toBe(before.done + 1)
    expect(toastMessages().join('|')).toMatch(new RegExp(`(已通过|已掌握) ${target.word}`))
  })

  it('should move a forgotten word out of today queue', async () => {
    const page = await mountPage()
    const store = useWordsStore()
    const target = store.dailyPlan.review.words[1]

    await page.get(`[aria-label="${target.word} 没记住"]`).trigger('click')
    await flushPromises()

    expect(page.findAll('.review-row').every((row) => !row.text().includes(target.word))).toBe(true)
    expect(toastMessages()).toContain(`明天再复习 ${target.word}`)
    // 后端把 nextReviewAt 排到明天，刷新清单也不会再出现
    const plan = await mockWords.dailyPlan()
    expect(plan.review.words.some((item) => item.id === target.id)).toBe(false)
  })

  it('should pass every remaining word in one batch and show the done state', async () => {
    const page = await mountPage()
    const store = useWordsStore()
    const total = store.dailyPlan.review.words.length

    await page
      .findAll('button')
      .find((button) => button.text() === '全部通过')
      .trigger('click')
    await flushPromises()

    expect(toastMessages()).toContain(`已通过 ${total} 个词`)
    expect(page.findAll('.review-row')).toHaveLength(0)
    expect(page.text()).toContain('今天的复习完成了')
  })

  it('should tell the user when the word was deleted elsewhere', async () => {
    const page = await mountPage()
    const target = useWordsStore().dailyPlan.review.words[0]

    await mockWords.remove(target.id)

    await page.get(`[aria-label="${target.word} 通过"]`).trigger('click')
    await flushPromises()

    expect(toastMessages()).toContain(`${target.word} 已经不在词库里了`)
  })
})
