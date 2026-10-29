/**
 * 意见反馈弹窗测试
 * 覆盖本地字数校验、分类选择、成功提交后清空语义（关闭 + 通知父级）、
 * 后端字段错误回到 textarea、以及「每天 5 条」的 429 提示。
 * 使用真实 mock adapter（延迟 0），接口层只包一层 spy。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import FeedbackModal from '../component/FeedbackModal.vue'
import { BusinessError } from '../../../errors'
import { setMockLatency } from '../../../mock/adapter'
import { submitFeedback } from '../../../api/feedback'

vi.mock('../../../api/feedback', async (importOriginal) => {
  const actual = await importOriginal()
  return { submitFeedback: vi.fn(actual.submitFeedback) }
})

const EmptyStub = { template: '<div />' }

let wrapper = null

async function mountModal() {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: EmptyStub },
      { path: '/profile', name: 'profile', component: EmptyStub },
    ],
  })
  await router.push('/profile')
  await router.isReady()

  wrapper = mount(FeedbackModal, {
    props: { open: true },
    attachTo: document.body,
    global: { plugins: [pinia, router], stubs: { teleport: true } },
  })

  await flushPromises()
  return wrapper
}

function submitButton() {
  return wrapper.findAll('button').find((button) => button.text() === '提交反馈')
}

beforeEach(() => {
  localStorage.clear()
  setMockLatency(0)
  vi.mocked(submitFeedback).mockClear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('FeedbackModal', () => {
  it('should block submission locally when the content is too short', async () => {
    await mountModal()

    await wrapper.get('textarea').setValue('太短了')
    await submitButton().trigger('click')
    await flushPromises()

    expect(wrapper.get('.field-error').text()).toContain('至少 10 个字')
    expect(submitFeedback).not.toHaveBeenCalled()
    // 计数器读的是去空白后的长度
    expect(wrapper.get('.field-count').text()).toBe('3/2000')
  })

  it('should submit the trimmed content with the category and current page', async () => {
    await mountModal()

    // 分类下拉：选「功能异常」（对应后端枚举 bug）
    await wrapper.get('.dropdown-trigger').trigger('click')
    const bugOption = wrapper
      .findAll('[role="option"]')
      .find((option) => option.text().includes('功能异常'))
    await bugOption.trigger('click')

    await wrapper.get('textarea').setValue('  生成到一半一直停在 60%，希望可以重试  ')
    await submitButton().trigger('click')
    await flushPromises()

    expect(submitFeedback).toHaveBeenCalledWith({
      category: 'bug',
      content: '生成到一半一直停在 60%，希望可以重试',
      page: '/profile',
    })
    // 没填联系方式就不发空串
    expect(vi.mocked(submitFeedback).mock.calls[0][0].contact).toBeUndefined()

    expect(wrapper.emitted('submitted')).toHaveLength(1)
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('should show the server content error under the textarea', async () => {
    vi.mocked(submitFeedback).mockRejectedValueOnce(
      new BusinessError('反馈内容至少 10 个字', 'FEEDBACK_TOO_SHORT', {
        field: 'content',
        details: { minLength: 10, maxLength: 2000 },
      }),
    )

    await mountModal()
    // 必须过本地 10 字校验，否则请求不会发出，mockRejectedValueOnce 会留给下一个用例
    await wrapper.get('textarea').setValue('刚好十个字的内容啊啊')
    await submitButton().trigger('click')
    await flushPromises()

    expect(wrapper.get('.field-error').text()).toBe('反馈内容至少 10 个字')
    expect(wrapper.emitted('submitted')).toBeUndefined()
  })

  // 每设备每天 5 条：没有倒计时，文案只说「明天再来」，弹窗保持打开
  it('should explain the daily feedback limit without a countdown', async () => {
    vi.mocked(submitFeedback).mockRejectedValueOnce(
      new BusinessError('请求太频繁', 'RATE_LIMITED', { details: { scope: 'feedback' } }),
    )

    await mountModal()
    await wrapper.get('textarea').setValue('这是一条足够长的反馈内容')
    await submitButton().trigger('click')
    await flushPromises()

    expect(wrapper.get('.form-error').text()).toContain('明天再来')
    expect(wrapper.get('.form-error').text()).not.toContain('秒')
    expect(wrapper.emitted('submitted')).toBeUndefined()
  })
})
