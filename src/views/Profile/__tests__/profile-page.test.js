/**
 * 个人中心页面测试
 * 覆盖资料头图、三张统计卡、近 12 周柱状图、昵称与密码弹窗、加载骨架与失败重试；
 * 使用真实 mock adapter（延迟 0），接口层只包一层 spy 以便制造一次性失败。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import ProfilePage from '../index.vue'
import { mockProfile, resetMockDb, setMockLatency } from '../../../mock/adapter'
import { BusinessError } from '../../../errors'
import { useToastStore } from '../../../stores/model/toast'
import { fetchProfile } from '../../../api/profile'

vi.mock('../../../api/profile', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchProfile: vi.fn(actual.fetchProfile),
    fetchProfileStats: vi.fn(actual.fetchProfileStats),
  }
})

let wrapper = null

function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)

  wrapper = mount(ProfilePage, {
    global: {
      plugins: [pinia],
      // 弹窗走 Teleport，测试里直接渲染在原位置便于断言
      stubs: { teleport: true },
    },
  })

  return wrapper
}

beforeEach(() => {
  localStorage.clear()
  resetMockDb()
  setMockLatency(0)
  vi.mocked(fetchProfile).mockClear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('Profile page', () => {
  it('should render the identity and the three stat cards', async () => {
    const stats = await mockProfile.stats()

    mountPage()
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('个人中心')
    expect(wrapper.get('.hero-name').text()).toBe('Sound')
    expect(wrapper.get('.hero-id').text()).toBe('ID: local-user')
    expect(wrapper.get('.hero-signature').text()).toBe('「少年，大胆走，怎么都是路。」')

    expect(wrapper.get('.stat-number').text()).toBe(
      stats.reading.totalTokens.toLocaleString('zh-CN'),
    )
    expect(wrapper.findAll('.weekly-bar')).toHaveLength(12)
    expect(wrapper.get('.ring-number').text()).toBe(String(stats.questions.accuracy))
    expect(wrapper.get('.accuracy-breakdown').text()).toContain(String(stats.questions.correct))
    // 已完成文章数取的是已提交篇数
    expect(wrapper.findAll('.stat-number')[1].text()).toBe(String(stats.reading.completedCount))
  })

  it('should show the skeleton before the profile arrives', async () => {
    vi.mocked(fetchProfile).mockReturnValueOnce(new Promise(() => {}))

    mountPage()
    await nextTick()

    expect(wrapper.find('.skeleton-hero').exists()).toBe(true)
    expect(wrapper.find('.skeleton-stats').exists()).toBe(true)
    expect(wrapper.find('.profile-hero').exists()).toBe(false)
  })

  it('should update the nickname and signature from the edit modal', async () => {
    mountPage()
    await flushPromises()

    await wrapper.get('.hero-edit').trigger('click')
    await nextTick()

    await wrapper.get('input[name="nickname"]').setValue('  小树  ')
    await wrapper.get('input[name="signature"]').setValue('慢一点也没关系')
    await wrapper.get('#profile-edit-form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('.hero-name').text()).toBe('小树')
    expect(wrapper.get('.hero-signature').text()).toBe('「慢一点也没关系」')
    expect(wrapper.find('#profile-edit-form').exists()).toBe(false)
    expect(useToastStore().items.map((item) => item.message)).toContain('个人资料已更新')

    // 重新进页面仍然读得到刚改的昵称
    const again = await mockProfile.get()
    expect(again.user.nickname).toBe('小树')
  })

  it('should reject an empty nickname before calling the api', async () => {
    mountPage()
    await flushPromises()

    await wrapper.get('.hero-edit').trigger('click')
    await nextTick()

    await wrapper.get('input[name="nickname"]').setValue('   ')
    await wrapper.get('#profile-edit-form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('.input-message.is-error').text()).toBe('昵称不能为空')
    expect(wrapper.get('.hero-name').text()).toBe('Sound')
  })

  it('should validate the password form and close it after success', async () => {
    mountPage()
    await flushPromises()

    await wrapper.findAll('button.setting-row')[1].trigger('click')
    await nextTick()

    await wrapper.get('input[name="old-password"]').setValue('oldpass1')
    await wrapper.get('input[name="new-password"]').setValue('short')
    await wrapper.get('input[name="confirm-password"]').setValue('short')
    await wrapper.get('#password-form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('.input-message.is-error').text()).toContain('至少 8 位')
    expect(wrapper.find('#password-form').exists()).toBe(true)

    await wrapper.get('input[name="new-password"]').setValue('newpass12')
    await wrapper.get('input[name="confirm-password"]').setValue('newpass12')
    await wrapper.get('#password-form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('#password-form').exists()).toBe(false)
    expect(useToastStore().items.map((item) => item.message)).toContain('密码已更新')
  })

  it('should explain a failed load and retry', async () => {
    vi.mocked(fetchProfile).mockRejectedValueOnce(
      new BusinessError('服务暂时不可用', 'INTERNAL_ERROR', { requestId: 'req-profile-1' }),
    )

    mountPage()
    await flushPromises()

    const alert = wrapper.get('.state-card')
    expect(alert.text()).toContain('服务暂时不可用')
    expect(alert.text()).toContain('req-profile-1')

    const retry = wrapper.findAll('button').find((button) => button.text() === '重试')
    await retry.trigger('click')
    await flushPromises()

    expect(wrapper.find('.state-card').exists()).toBe(false)
    expect(wrapper.get('.hero-name').text()).toBe('Sound')
  })
})
