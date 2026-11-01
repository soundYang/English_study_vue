/**
 * 阅读设置页 · 自选单词接到生成参数
 * 覆盖的是「交接单里到底有什么」：不选就完全不发 focusWords（后端收到 [] 会 400），
 * 选了就按顺序带过去。选词弹窗被 Teleport 到 body，所以点击走 document.body。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import SettingsPage from '../index.vue'
import { fetchQuota } from '../../../api/quota'
import {
  clearGenerationHandoff,
  takeGenerationHandoff,
} from '../../../composables/useGenerationHandoff'
import { resetMockDb, setMockLatency } from '../../../mock/adapter'
import { localStore, storageKeys } from '../../../unit/storage'

vi.mock('../../../api/quota', () => ({ fetchQuota: vi.fn() }))

const SETTLE_MS = 320

const QUOTA_ALLOWED = {
  day: '2026-10-29',
  resetAt: '2026-10-29T16:00:00.000Z',
  primary: { scope: 'device', limit: 3, used: 1, remaining: 2 },
  blocking: null,
  breakdown: [],
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/settings', name: 'settings', component: SettingsPage },
      { path: '/generating', name: 'generating', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' } },
    ],
  })
}

async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
  await flushPromises()
}

async function mountSettings() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createTestRouter()
  await router.push('/settings')
  await router.isReady()

  const wrapper = mount(SettingsPage, { global: { plugins: [pinia, router] } })
  await settle()
  return { wrapper, router }
}

/** 走真实选词路径：打开弹窗（组件内）→ 点词 / 关闭（弹窗被 Teleport 到 body） */
async function pickWords(wrapper, words) {
  wrapper.get('.focus-actions button').element.click()
  await flushPromises()

  for (const word of words) {
    // 结算后「复习中」多了一批词，目标词不一定在第一页：逐个搜索定位，
    // 不再依赖词库的默认排序（md/56 §5.3）
    const search = document.body.querySelector('input[aria-label="搜索单词"]')
    search.value = word
    search.dispatchEvent(new Event('input'))
    await settle()

    const item = [...document.body.querySelectorAll('.picker-item')].find((row) =>
      row.querySelector('.item-word').textContent.trim().startsWith(word),
    )
    item.click()
    await flushPromises()
  }

  const done = [...document.body.querySelectorAll('button')].find(
    (button) => button.textContent.trim() === '完成',
  )
  done.click()
  await flushPromises()
}

beforeEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
  localStore.set(storageKeys.accessToken, 'sess_focus_words')
  resetMockDb()
  setMockLatency(0)
  clearGenerationHandoff()
  vi.clearAllMocks()
  fetchQuota.mockResolvedValue(QUOTA_ALLOWED)
})

describe('settings page · focus words in the handoff', () => {
  it('should omit focusWords entirely when nothing is picked', async () => {
    const { wrapper, router } = await mountSettings()

    // jsdom 里点 type=submit 的按钮不会触发表单提交，直接派发 submit（等同回车）
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const handoff = takeGenerationHandoff()
    expect(router.currentRoute.value.path).toBe('/generating')
    // 显式 [] 会被后端判成参数错误，不选就一个键都不发（md/54 §3.2）
    expect(handoff.payload).not.toHaveProperty('focusWords')
    wrapper.unmount()
  })

  it('should carry the picked words in the order they were chosen', async () => {
    const { wrapper } = await mountSettings()

    await pickWords(wrapper, ['tired', 'garden'])

    // jsdom 里点 type=submit 的按钮不会触发表单提交，直接派发 submit（等同回车）
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(takeGenerationHandoff().payload.focusWords).toEqual(['tired', 'garden'])
    wrapper.unmount()
  })
})
