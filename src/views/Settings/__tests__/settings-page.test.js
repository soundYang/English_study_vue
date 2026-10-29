/**
 * 阅读设置页 · 预检联动测试
 * 页面不再用词表估算可用词，改为 /capacity：上限跟难度走，篇幅超限要夹回。
 * 预检是 250ms 防抖，这里等真实时间（mock 延迟为 0）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import SettingsPage from '../index.vue'
import LengthPicker from '../component/LengthPicker.vue'
import { fetchQuota } from '../../../api/quota'
import { resetMockDb, setMockLatency } from '../../../mock/adapter'
import { storageKeys } from '../../../unit/storage'

// 额度只影响「开始生成」按钮与提示，单独替换掉，避免每个页面用例都依赖 mock 快照
vi.mock('../../../api/quota', () => ({ fetchQuota: vi.fn() }))

const SETTLE_MS = 320
// hard / 600：写 600 词要 708 个已知词，种子库只有 638 个
const HARD_600 = {
  level: 'hard',
  targetWords: 600,
  questionCount: 5,
  updatedAt: new Date().toISOString(),
}

const QUOTA_ALLOWED = {
  day: '2026-10-29',
  resetAt: '2026-10-29T16:00:00.000Z',
  primary: { scope: 'device', limit: 3, used: 1, remaining: 2 },
  blocking: null,
  breakdown: [],
}

const QUOTA_BLOCKED = {
  ...QUOTA_ALLOWED,
  blocking: { scope: 'device', limit: 3, used: 3, remaining: 0 },
}

function seedSettings(settings) {
  localStorage.setItem(storageKeys.settings, JSON.stringify(settings))
}

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
  vi.clearAllMocks()
  fetchQuota.mockResolvedValue(QUOTA_ALLOWED)
})

describe('settings page capacity note', () => {
  it('should say the current settings are writable when the gates are clear', async () => {
    const wrapper = await mountSettings()

    // 默认 easy / 100 词：已知词 20 + 618 = 638，写 100 词的下限是 633
    expect(wrapper.get('.capacity-note').text()).toContain('当前难度可写 300 词以内')
    expect(wrapper.find('.capacity-warn').exists()).toBe(false)
  })

  it('should report the known-words gap for a length the vocabulary cannot support', async () => {
    seedSettings(HARD_600)
    const wrapper = await mountSettings()

    // md/30 §7 之后门禁随篇幅走：600 词要 708 个已知词，当前 638 个
    expect(wrapper.get('.capacity-note').text()).toContain('还差 70 个')
  })

  it('should say why each level is not writable without disabling it', async () => {
    seedSettings(HARD_600)
    const wrapper = await mountSettings()
    const notes = wrapper.findAll('.card-note')

    // 600 词超出 easy / medium 的档位上限，hard 是认识词不够
    expect(notes).toHaveLength(3)
    expect(notes[0].text()).toBe('最多写 300 词')
    expect(notes[1].text()).toBe('最多写 450 词')
    expect(notes[2].text()).toBe('还差 70 个认识词')
    // 只说缘由不禁用：三档一起不够时禁用会让用户一步也走不了
    expect(wrapper.findAll('[role="radio"]:disabled')).toHaveLength(0)
  })

  it('should narrow the precheck when the scope is limited', async () => {
    const wrapper = await mountSettings()
    expect(wrapper.get('.capacity-note').text()).toContain('当前难度可写 300 词以内')

    // 种子词的 createdAt 都是过去的日子，「今天新学」的池子是空的：
    // 已知词只剩 618 的地板，写 100 词要 633 个
    await wrapper.findAll('[role="checkbox"]')[0].trigger('click')
    await settle()

    expect(wrapper.get('.scope-chip.is-active').text()).toBe('今天新学')
    expect(wrapper.get('.capacity-note').text()).toContain('还差 15 个')
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

  it('should show the new-words switch only outside easy', async () => {
    const wrapper = await mountSettings()

    // easy 的 0 生词是难度承诺，不提供开关（后端对 easy + true 直接 400）
    expect(wrapper.find('[role="switch"]').exists()).toBe(false)

    await wrapper.findAll('[role="radio"]')[1].trigger('click')
    await settle()

    const toggle = wrapper.get('[role="switch"]')
    expect(toggle.attributes('aria-checked')).toBe('false')
    // 自动 + 非最终模式 = 关；额度只是上限
    expect(wrapper.text()).toContain('只用你认识的词')
  })

  it('should save an explicit allowNewWords choice', async () => {
    const wrapper = await mountSettings()

    await wrapper.findAll('[role="radio"]')[1].trigger('click')
    await settle()
    await wrapper.get('[role="switch"]').trigger('click')

    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存设置')
      .trigger('click')
    await settle()

    const stored = JSON.parse(localStorage.getItem(storageKeys.settings))
    expect(stored).toMatchObject({ level: 'medium', allowNewWords: true })
    expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('should drop the switch back to automatic when the level returns to easy', async () => {
    seedSettings({
      level: 'medium',
      targetWords: 100,
      questionCount: 5,
      allowNewWords: true,
      updatedAt: new Date().toISOString(),
    })
    const wrapper = await mountSettings()
    expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('true')

    await wrapper.findAll('[role="radio"]')[0].trigger('click')
    await settle()

    expect(wrapper.find('[role="switch"]').exists()).toBe(false)

    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存设置')
      .trigger('click')
    await settle()

    // easy + true 会被后端 400，保存时必须清成自动（请求里不带这个键）
    expect(JSON.parse(localStorage.getItem(storageKeys.settings)).allowNewWords).toBeNull()
  })

  it('should clamp the length when the level max shrinks', async () => {
    // 先落一份 hard / 600 的设置，让页面从一个超出现有难度上限的篇幅起步
    seedSettings(HARD_600)

    const wrapper = await mountSettings()
    expect(wrapper.findComponent(LengthPicker).props('modelValue')).toBe(600)

    // 切到 easy：上限从 600 掉到 300，草稿要跟着夹住
    await wrapper.findAll('[role="radio"]')[0].trigger('click')
    await flushPromises()

    expect(wrapper.findComponent(LengthPicker).props('modelValue')).toBe(300)
    expect(wrapper.findComponent(LengthPicker).props('max')).toBe(300)
  })
})

describe('settings page daily quota', () => {
  it('should show the remaining quota next to the generate action', async () => {
    const wrapper = await mountSettings()

    expect(wrapper.get('.quota-note').text()).toBe('今日剩余 2 次')
  })

  it('should disable generating and explain when the quota runs out', async () => {
    fetchQuota.mockResolvedValue(QUOTA_BLOCKED)
    const wrapper = await mountSettings()
    const generate = wrapper.findAll('button').find((button) => button.text() === '开始生成')

    expect(generate.attributes('disabled')).toBeDefined()
    expect(wrapper.get('.quota-note').text()).toContain('设备每天最多生成 3 次')
    expect(wrapper.get('.quota-note').classes()).toContain('is-blocked')
  })

  it('should stay usable when the quota request fails', async () => {
    fetchQuota.mockRejectedValue(new Error('网络错误'))
    const wrapper = await mountSettings()
    const generate = wrapper.findAll('button').find((button) => button.text() === '开始生成')

    // fail-open：额度未知不挡人，真没额度时后端建任务会返回 429
    expect(generate.attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.quota-note').exists()).toBe(false)
  })
})
