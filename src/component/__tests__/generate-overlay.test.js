/**
 * 生成覆盖层 · 失败出口
 * 429 只给「返回修改 / 知道了」；retryable=false 不给重试；
 * 其余错误的重试交给 store（任务终态走 /retry），并把人带回生成页看纸页。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import GenerateOverlay from '../GenerateOverlay.vue'
import { useReadingStore } from '../../stores/model/reading'

const EmptyStub = { template: '<div />' }

let wrapper = null

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: EmptyStub },
      { path: '/settings', name: 'settings', component: EmptyStub },
      { path: '/generating', name: 'generating', component: EmptyStub },
      { path: '/profile', name: 'profile', component: EmptyStub },
    ],
  })
}

async function mountOverlay(error, setup) {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createTestRouter()
  await router.push('/')
  await router.isReady()

  const store = useReadingStore()
  store.phase = 'error'
  store.error = { field: '', details: {}, requestId: '', ...error }
  if (setup) setup(store)

  wrapper = mount(GenerateOverlay, {
    attachTo: document.body,
    global: { plugins: [pinia, router], stubs: { teleport: true } },
  })

  return { store, router }
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.classList.remove('has-modal-open')
})

describe('GenerateOverlay', () => {
  it('should explain the 429 with the window size and drop the retry button', async () => {
    const { store } = await mountOverlay({
      code: 'RATE_LIMITED',
      message: '生成太频繁：每分钟最多 20 次，请稍后再试。',
      details: { limit: 20, windowSeconds: 60 },
    })

    expect(wrapper.get('.generate-title').text()).toBe('生成太频繁了')
    expect(wrapper.get('.generate-hint').text()).toContain('每分钟最多生成 20 次')
    // 后端 message 与 hint 说的是同一件事，不重复展示
    expect(wrapper.find('.generate-subtitle').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('重试')

    const dismiss = wrapper.findAll('button').find((button) => button.text() === '知道了')
    await dismiss.trigger('click')

    expect(store.phase).toBe('idle')
  })

  // 额度用完是「等明天」，不是「等一分钟」：文案按 scope 区分，也不给重试；
  // 但要给「去接入 API Key」——免费次数用完不等于不能生成（md/43 §12）
  it('should explain the exhausted daily quota and point at the own API key', async () => {
    const { router } = await mountOverlay({
      code: 'QUOTA_EXCEEDED',
      message: '今天的 3 次生成额度已用完，明天 00:00 重置',
      details: { scope: 'device', limit: 3, used: 3, resetAt: '2026-10-29T16:00:00.000Z' },
      retryable: false,
    })

    expect(wrapper.get('.generate-title').text()).toBe('今天的免费生成次数用完了')
    expect(wrapper.get('.generate-hint').text()).toContain('设备每天最多免费生成 3 次')
    expect(wrapper.get('.generate-hint').text()).toContain('接入自己的 API Key')
    expect(wrapper.get('.generate-hint').text()).toContain('北京时间')
    // 后端 message 与 hint 重复，不展示 subtitle
    expect(wrapper.find('.generate-subtitle').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('重试')

    // 跳转方式：落到个人中心的 API 设置卡
    const link = wrapper.findAll('button').find((button) => button.text() === '去接入 API Key')
    await link.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/profile')
    expect(router.currentRoute.value.hash).toBe('#api-settings')
  })

  // 免费池用尽是 503 而不是 429：没有 resetAt / Retry-After，文案原样透传后端 message，
  // 出口同样是接入自己的 Key（md/36 §10 ①②③）
  it('should pass the free-budget message through without retry or cooldown', async () => {
    const message = '免费生成额度已用完，请接入自己的 API Key 后继续使用'
    await mountOverlay({
      code: 'FREE_BUDGET_EXHAUSTED',
      message,
      details: { limitTokens: 200000000, usedTokens: 200000031 },
      retryable: false,
    })

    expect(wrapper.get('.generate-title').text()).toBe('免费生成额度用完了')
    // 透传而不是改写：后端 message 原样出现
    expect(wrapper.get('.generate-subtitle').text()).toBe(message)
    expect(wrapper.text()).not.toContain('重试')
    expect(wrapper.text()).not.toContain('返回修改')
    // 没有任何恢复时间 / 倒计时
    expect(wrapper.text()).not.toContain('明天')
    expect(wrapper.text()).not.toContain('秒后')
    // 两个出口：接入自己的 Key，或者先关掉
    expect(wrapper.findAll('button').map((button) => button.text())).toEqual([
      '知道了',
      '去接入 API Key',
    ])
  })

  // 0 词用户点 300 词：不走「降难度」，只给缩篇幅与加词两条路（md/39）
  it('should point a 20-word-gate failure at shorter pieces instead of lowering the level', async () => {
    await mountOverlay(
      { code: 'INSUFFICIENT_VOCABULARY', message: '当前已有 0 个单词，至少需要 20 个才能生成' },
      (store) => {
        store.summary = { level: 'medium', targetWords: 300, questionCount: 3, availableWords: 0 }
      },
    )

    expect(wrapper.get('.generate-title').text()).toBe('词汇太少，暂时写不了这篇文章')
    expect(wrapper.get('.generate-hint').text()).toContain('100 / 200')
    expect(wrapper.text()).toContain('缩短文章')
    expect(wrapper.text()).toContain('去添加单词')
    expect(wrapper.text()).not.toContain('降低难度')
    expect(wrapper.text()).not.toContain('重试')
  })

  // 3N 门槛（md/57 §8.2）：缺口上千时主按钮要落在「缩短文章」，
  // 别把用户往「去添加单词」带——补 1015 个词不是这一篇能解决的事
  it('should make shortening the primary action when the vocabulary gap is huge', async () => {
    await mountOverlay(
      {
        code: 'VOCABULARY_TOO_SMALL',
        message: '这个篇幅需要认识约 1800 个单词，当前 785 个',
        details: {
          kind: 'known_words',
          level: 'hard',
          required: 1800,
          available: 785,
          shortage: 1015,
        },
      },
      (store) => {
        store.summary = { level: 'hard', targetWords: 600, questionCount: 3, availableWords: 785 }
      },
    )

    const buttons = wrapper.findAll('.generate-actions button')
    expect(buttons.map((button) => button.text())).toEqual(['缩短文章', '降低难度', '去添加单词'])
    expect(buttons[0].classes()).toContain('is-primary')
    expect(buttons[1].classes()).toContain('is-secondary')
    expect(buttons[2].classes()).toContain('is-secondary')
  })

  it('should keep the retry button for other failures', async () => {
    await mountOverlay({ code: 'AI_PROVIDER_ERROR', message: '暂时没有可用的生成模板' })

    expect(wrapper.get('.generate-title').text()).toBe('这次生成没有成功')
    expect(wrapper.get('.generate-subtitle').text()).toBe('暂时没有可用的生成模板')
    expect(wrapper.text()).toContain('重试')
    // 重试会复用已写好的段，这句是承诺也是解释
    expect(wrapper.get('.generate-note').text()).toContain('已经写好的部分不会重来')
  })

  it('should hide retry when the server says the failure is not retryable', async () => {
    await mountOverlay({
      code: 'INVALID_REQUEST',
      message: '参数不合法',
      retryable: false,
    })

    expect(wrapper.text()).not.toContain('重试')
    expect(wrapper.find('.generate-note').exists()).toBe(false)
    // 至少留一条能走的路
    expect(wrapper.text()).toContain('返回修改')
  })

  it('should distinguish the attempt without quoting a reused segment count', async () => {
    await mountOverlay(
      { code: 'AI_PROVIDER_ERROR', message: '上游挂了', retryable: true },
      (store) => {
        store.task = { taskId: 't1', retryCount: 1 }
      },
    )

    expect(wrapper.get('.generate-title').text()).toBe('第 2 次尝试没有成功')
    expect(wrapper.text()).not.toContain('复用')
  })

  // 自备 Key 失效不是登录问题，也不是重试能解决的：唯一出口是去个人中心换 Key（md/43 §9）
  it('should send an invalid api key to the profile page without retry', async () => {
    const { router } = await mountOverlay({
      code: 'USER_API_KEY_INVALID',
      message: '这把 API Key 无效或已过期，请检查后重新导入',
    })

    expect(wrapper.get('.generate-title').text()).toBe('你的 API Key 被拒绝了')
    expect(wrapper.get('.generate-hint').text()).toContain('个人中心')
    // 后端 message 与 hint 说的是同一件事，不重复展示
    expect(wrapper.find('.generate-subtitle').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('重试')
    expect(wrapper.text()).not.toContain('返回修改')

    const button = wrapper.findAll('button').find((item) => item.text() === '去设置')
    await button.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('profile')
  })

  // 任务创建时用了 Key、执行前被删：409，同样不给重试
  it('should ask for a re-import when the key disappeared mid-task', async () => {
    await mountOverlay({
      code: 'USER_API_KEY_MISSING',
      message: '生成时使用的 API Key 已被删除',
    })

    expect(wrapper.get('.generate-title').text()).toBe('这次用的 API Key 已经不在了')
    expect(wrapper.get('.generate-hint').text()).toContain('重新导入')
    expect(wrapper.text()).not.toContain('重试')
    expect(wrapper.text()).toContain('去设置')
  })

  // 队满 503：参数没错，别把人往设置页赶；按钮按 Retry-After 置灰（md/22 第 68 行）
  it('should explain a saturated queue and hold the retry for the cooldown', async () => {
    await mountOverlay({
      code: 'GENERATION_SATURATED',
      message: '当前生成人数较多，请稍后再试',
      details: { retryAfter: 5, active: 4, queued: 16, maxActive: 4, maxQueue: 16 },
      retryable: true,
    })

    expect(wrapper.get('.generate-title').text()).toBe('当前生成人数较多')
    expect(wrapper.get('.generate-hint').text()).toContain('不占用今天的免费次数')
    // 后端 message 与 hint 是同一件事，不重复展示
    expect(wrapper.find('.generate-subtitle').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('返回修改')

    const retry = wrapper.findAll('button').find((button) => button.text().includes('重试'))
    expect(retry.text()).toBe('重试（5s）')
    expect(retry.attributes('disabled')).toBeDefined()
    // 这次一个字都还没写，不能承诺「已经写好的部分不会重来」
    expect(wrapper.find('.generate-note').exists()).toBe(false)
  })

  // 整篇超时不是「接上次继续」：按钮写「重新生成」（md/22 第 69 行）
  it('should call a timeout a timeout and offer a full re-run', async () => {
    await mountOverlay({
      code: 'GENERATION_TIMEOUT',
      message: '生成超时',
      details: { deadlineMs: 120000 },
      retryable: true,
    })

    expect(wrapper.get('.generate-title').text()).toBe('这次生成超时了')
    expect(wrapper.get('.generate-hint').text()).toContain('120 秒')
    expect(wrapper.get('.generate-hint').text()).toContain('退回')
    expect(wrapper.text()).toContain('重新生成')
    // 超时没有 Retry-After：不该凭空冒出倒计时
    expect(wrapper.text()).not.toContain('（s）')
  })

  // 上游繁忙可重试，已写好的段会保留（md/22 第 70 行）
  it('should let a busy provider be retried after the cooldown', async () => {
    await mountOverlay({
      code: 'AI_PROVIDER_BUSY',
      message: 'AI 服务暂时繁忙',
      details: { retryAfter: 10 },
      retryable: true,
    })

    expect(wrapper.get('.generate-title').text()).toBe('AI 服务暂时繁忙')
    expect(wrapper.get('.generate-hint').text()).toContain('10 秒')
    expect(wrapper.get('.generate-note').text()).toContain('已经写好的部分不会重来')

    const retry = wrapper.findAll('button').find((button) => button.text().includes('重试'))
    expect(retry.text()).toBe('稍后重试（10s）')
    expect(retry.attributes('disabled')).toBeDefined()
  })

  it('should hand the retry to the store and go back to the paper stage', async () => {
    const retry = vi.fn().mockResolvedValue(true)
    const { router } = await mountOverlay(
      { code: 'AI_PROVIDER_ERROR', message: '上游挂了', retryable: true },
      (store) => {
        store.retryGeneration = retry
      },
    )

    const button = wrapper.findAll('button').find((item) => item.text() === '重试')
    await button.trigger('click')
    await flushPromises()

    expect(retry).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.name).toBe('generating')
  })
})
