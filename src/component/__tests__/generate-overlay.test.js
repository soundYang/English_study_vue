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

  // 额度用完是「等明天」，不是「等一分钟」：文案按 scope 区分，也不给重试
  it('should explain the exhausted daily quota without a retry button', async () => {
    await mountOverlay({
      code: 'QUOTA_EXCEEDED',
      message: '今天的 3 次生成额度已用完，明天 00:00 重置',
      details: { scope: 'device', limit: 3, used: 3, resetAt: '2026-10-29T16:00:00.000Z' },
      retryable: false,
    })

    expect(wrapper.get('.generate-title').text()).toBe('今天的生成次数用完了')
    expect(wrapper.get('.generate-hint').text()).toContain('设备每天最多生成 3 次')
    expect(wrapper.get('.generate-hint').text()).toContain('北京时间')
    // 后端 message 与 hint 重复，不展示 subtitle
    expect(wrapper.find('.generate-subtitle').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('重试')
    expect(wrapper.text()).toContain('知道了')
  })

  // 免费池用尽是 503 而不是 429：没有 resetAt / Retry-After，文案原样透传后端 message，
  // 除了「知道了」不提供任何动作（md/36 §10 ①②③）
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
    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(wrapper.get('button').text()).toBe('知道了')
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
