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

  it('should say which levels are still short of known words', async () => {
    const wrapper = await mountSettings()
    const notes = wrapper.findAll('.card-note')

    // 三档都写出来，用户才知道该加多少词，而不是逐档点一遍试
    expect(notes).toHaveLength(3)
    expect(notes[0].text()).toContain('还差 380 个认识词')
    expect(notes[2].text()).toContain('还差 1180 个认识词')
    // 只说缘由不禁用：三档一起不够时禁用会让用户一步也走不了
    expect(wrapper.findAll('[role="radio"]:disabled')).toHaveLength(0)
  })

  it('should narrow the precheck when the scope is limited', async () => {
    const wrapper = await mountSettings()
    expect(wrapper.get('.capacity-note').text()).toContain('还差 380 个')

    // 种子词的 createdAt 都是过去的日子，「今天新学」的池子是空的
    await wrapper.findAll('[role="checkbox"]')[0].trigger('click')
    await settle()

    expect(wrapper.get('.scope-chip.is-active').text()).toBe('今天新学')
    expect(wrapper.get('.capacity-note').text()).toContain('还差 400 个')
  })

  it('should save the chosen scope with the other settings', async () => {
    const wrapper = await mountSettings()

    await wrapper.findAll('[role="checkbox"]')[1].trigger('click')
    await settle()

    const saveButton = wrapper.findAll('button').find((button) => button.text() === '保存设置')
    expect(saveButton.attributes('disabled')).toBeUndefined()

    await saveButton.trigger('click')
    await settle()

    expect(JSON.parse(localStorage.getItem(storageKeys.settings)).vocabScope).toEqual([
      'today_reviewed',
    ])
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
