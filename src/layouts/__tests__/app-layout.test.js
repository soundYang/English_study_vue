/**
 * 应用布局 · 页面切换测试
 * 重点验证：路由已经变化、旧页面还在淡出时，内容容器继续使用旧页面的宽度 / 内边距；
 * 等新页面入场（opacity: 0）时才换成目标页的 flush / wide 布局。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppLayout from '../AppLayout.vue'
import { localStore, storageKeys } from '../../unit/storage'

const flushPage = {
  name: 'FlushPage',
  template: '<section class="page">首页</section>',
}

const wordsPage = {
  name: 'WordsPage',
  template: '<section class="page">我的单词</section>',
}

let wrapper = null

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  if (wrapper) wrapper.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

async function mountLayout({ authenticated = false } = {}) {
  if (authenticated) {
    localStore.set(storageKeys.accessToken, 'sess_layout_test')
    localStore.set(storageKeys.authUser, { id: 'u_1', username: 'Sound', nickname: 'Sound' })
  }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: flushPage, meta: { module: 'home', flush: true } },
      { path: '/words', name: 'words', component: wordsPage, meta: { module: 'words' } },
    ],
  })

  await router.push('/words')
  await router.isReady()

  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(AppLayout, {
    attachTo: document.body,
    // 默认 stub 会跳过 transition 钩子，这里要用真实的 Transition 验证切换时机
    global: { plugins: [pinia, router], stubs: { transition: false } },
  })
  await flushPromises()

  return { wrapper, router }
}

describe('AppLayout guest header', () => {
  it('should show a login action instead of a fake demo identity', async () => {
    const { wrapper } = await mountLayout()

    expect(wrapper.get('.topbar-login').text()).toContain('登录 / 注册')
    expect(wrapper.get('.topbar-login').attributes('href')).toBe('/login')
    expect(wrapper.find('.topbar-user').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Sound')
  })

  it('should keep the profile entry for signed-in users', async () => {
    const { wrapper } = await mountLayout({ authenticated: true })

    expect(wrapper.get('.topbar-user').text()).toContain('Sound')
    expect(wrapper.get('.topbar-user').attributes('href')).toBe('/profile')
    expect(wrapper.find('.topbar-login').exists()).toBe(false)
  })
})

describe('AppLayout page transition', () => {
  it('should keep the old content width until the next page enters', async () => {
    const { wrapper, router } = await mountLayout()

    expect(wrapper.get('.main-inner').classes()).not.toContain('is-flush')

    await router.push('/')
    await wrapper.vm.$nextTick()

    // 旧页正在淡出，容器仍保持普通页面的宽度与内边距，不能被目标页撑满
    expect(wrapper.get('.main-inner').classes()).not.toContain('is-flush')

    await new Promise((resolve) => setTimeout(resolve, 80))
    await flushPromises()

    // 新页面入场后布局才切换
    expect(wrapper.get('.main-inner').classes()).toContain('is-flush')
    expect(wrapper.get('.page').text()).toContain('首页')
  })

  it('should switch back to the normal layout when entering a normal page', async () => {
    const { wrapper, router } = await mountLayout()

    await router.push('/')
    await new Promise((resolve) => setTimeout(resolve, 80))
    await flushPromises()
    expect(wrapper.get('.main-inner').classes()).toContain('is-flush')

    await router.push('/words')
    await wrapper.vm.$nextTick()

    // 离场中的满幅页同样保持原布局
    expect(wrapper.get('.main-inner').classes()).toContain('is-flush')

    await new Promise((resolve) => setTimeout(resolve, 80))
    await flushPromises()

    expect(wrapper.get('.main-inner').classes()).not.toContain('is-flush')
    expect(wrapper.get('.page').text()).toBe('我的单词')
  })
})
