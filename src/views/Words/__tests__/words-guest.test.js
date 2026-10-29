/**
 * 我的单词 · 游客态测试
 * 锁住 md/45 §5.2：不请求私人列表、渲染遮罩行、写操作与搜索都去登录。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import WordsView from '../index.vue'
import { resetMockDb, setMockLatency } from '../../../mock/adapter'
import { useWordsStore } from '../../../stores/model/words'

const LoginStub = { template: '<div class="login-stub" />' }

let wrapper = null

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/words', name: 'words', component: WordsView },
      { path: '/login', name: 'login', component: LoginStub },
    ],
  })
}

async function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createTestRouter()
  await router.push('/words')
  await router.isReady()

  wrapper = mount(WordsView, {
    attachTo: document.body,
    global: {
      plugins: [pinia, router],
      stubs: { teleport: true, 'transition-group': false },
    },
  })

  await flushPromises()
  return { router, pinia }
}

beforeEach(() => {
  localStorage.clear()
  resetMockDb()
  setMockLatency(0)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('Words page · guest', () => {
  it('should render masked rows without requesting the private list', async () => {
    await mountPage()

    const store = useWordsStore()

    expect(wrapper.findAll('tbody tr.word-row.is-masked')).toHaveLength(6)
    expect(wrapper.findAll('tbody tr.word-row:not(.is-masked)')).toHaveLength(0)
    expect(wrapper.text()).toContain('登录后查看你的单词')
    // 游客不发 GET /words，store 保持未加载
    expect(store.hasLoaded).toBe(false)
    expect(store.items).toHaveLength(0)
  })

  it('should disable search and the status tabs', async () => {
    await mountPage()

    expect(wrapper.get('input[type="search"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('input[type="search"]').attributes('placeholder')).toContain('登录后搜索')
  })

  it('should send every write entry to the login page with the current path', async () => {
    const { router } = await mountPage()

    const addButton = wrapper.findAll('button').find((button) => button.text() === '添加单词')
    await addButton.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/words')
  })
})
