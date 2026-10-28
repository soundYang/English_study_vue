/**
 * 阅读设置页 · 预检联动测试
 * 页面不再用词表估算可用词，改为 /capacity：上限跟难度走，篇幅超限要夹回。
 * 预检是 250ms 防抖，这里等真实时间（mock 延迟为 0）。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import SettingsPage from '../index.vue'
import LengthPicker from '../component/LengthPicker.vue'
import { resetMockDb, setMockLatency } from '../../../mock/adapter'
import { storageKeys } from '../../../unit/storage'

const SETTLE_MS = 320

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/settings', name: 'settings', component: SettingsPage }],
  })
}

// 防抖 250ms + 一次 mock 往返；flushPromises 兜住 Vue 的更新队列
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

  const wrapper = mount(SettingsPage, {
    global: { plugins: [pinia, router] },
  })

  await settle()
  return wrapper
}

beforeEach(() => {
  localStorage.clear()
  resetMockDb()
  setMockLatency(0)
})

describe('settings page capacity note', () => {
  it('should show the known-words shortfall for the current level', async () => {
    const wrapper = await mountSettings()

    // 默认 easy / 100 词，种子库 20 个可用词 + 600 个基础词，离 1000 还差 380
    expect(wrapper.get('.capacity-note').text()).toContain('还差 380 个')
  })

  it('should clamp the length when the level max shrinks', async () => {
    // 先落一份 hard / 600 的设置，让页面从一个超出现有难度上限的篇幅起步
    localStorage.setItem(
      storageKeys.settings,
      JSON.stringify({
        level: 'hard',
        targetWords: 600,
        questionCount: 5,
        updatedAt: new Date().toISOString(),
      }),
    )

    const wrapper = await mountSettings()
    expect(wrapper.findComponent(LengthPicker).props('modelValue')).toBe(600)

    // 切到 easy：上限从 600 掉到 300，草稿要跟着夹住
    await wrapper.findAll('[role="radio"]')[0].trigger('click')
    await flushPromises()

    expect(wrapper.findComponent(LengthPicker).props('modelValue')).toBe(300)
    expect(wrapper.findComponent(LengthPicker).props('max')).toBe(300)
  })
})
