/**
 * 应用根组件 · 401 处理
 * 公开页掉线只清会话、留在原地；受保护页掉线才去登录并保留 redirect（md/42）。
 * AppLayout 用 stub 替掉，避免把整套布局与请求带进用例。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'
import { fetchProfile } from '../api/profile'
import { AUTH_EXPIRED_EVENT } from '../unit/request'
import { localStore, storageKeys } from '../unit/storage'

vi.mock('../api/profile', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchProfile: vi.fn() }
})

const StubView = { template: '<div class="stub-view" />' }
const AppLayoutStub = { template: '<div class="layout-stub" />' }

let wrapper = null

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: StubView, meta: { public: true } },
      { path: '/profile', name: 'profile', component: StubView, meta: {} },
      { path: '/login', name: 'login', component: StubView, meta: { bare: true } },
    ],
  })
}

async function mountApp(path = '/') {
  const router = createTestRouter()
  await router.push(path)
  await router.isReady()

  const pinia = createPinia()
  setActivePinia(pinia)

  wrapper = mount(App, {
    global: {
      plugins: [pinia, router],
      stubs: { AppLayout: AppLayoutStub },
    },
  })
  await flushPromises()

  return { router }
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(fetchProfile).mockResolvedValue({
    user: { id: 'u_1', username: 'Sound', nickname: 'Sound' },
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('App auth expiry', () => {
  it('should clear the session but stay on a public page', async () => {
    localStore.set(storageKeys.accessToken, 'sess_app')
    const { router } = await mountApp('/')

    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/')
    expect(localStore.get(storageKeys.accessToken, '')).toBe('')
  })

  it('should not navigate when a guest hits a 401 on a public page', async () => {
    const { router } = await mountApp('/')

    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/')
  })

  it('should send an expired session on a protected page to login with redirect', async () => {
    localStore.set(storageKeys.accessToken, 'sess_app')
    const { router } = await mountApp('/profile')

    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/profile')
  })
})
