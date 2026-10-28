/**
 * 生成覆盖层 · 429 限流
 * 限流窗口内点「重试」必然还是 429，所以这一支只给「返回修改 / 知道了」，
 * 文案也不能把窗口长度说成剩余时间（md/22 §4）。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mount } from '@vue/test-utils'
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
    ],
  })
}

async function mountOverlay(error) {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createTestRouter()
  await router.push('/')
  await router.isReady()

  const store = useReadingStore()
  store.phase = 'error'
  store.error = { field: '', details: {}, requestId: '', ...error }

  wrapper = mount(GenerateOverlay, {
    attachTo: document.body,
    global: { plugins: [pinia, router], stubs: { teleport: true } },
  })

  return { store }
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

  it('should keep the retry button for other failures', async () => {
    await mountOverlay({ code: 'AI_PROVIDER_ERROR', message: '暂时没有可用的生成模板' })

    expect(wrapper.get('.generate-title').text()).toBe('这次生成没有成功')
    expect(wrapper.get('.generate-subtitle').text()).toBe('暂时没有可用的生成模板')
    expect(wrapper.text()).toContain('重试')
  })
})
