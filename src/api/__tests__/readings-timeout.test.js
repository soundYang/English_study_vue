/**
 * 生成接口超时透传测试
 * 生成阅读是唯一的长耗时接口，必须使用 config.generateTimeout（90 秒），
 * 否则会在全局的 15 秒处被 axios 中断。这里只验证「配置有没有传下去」。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../unit/request', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn().mockResolvedValue({ id: 'r1' }),
}))

// 关掉 mock 分支，让 generateReading 走真实的 apiPost 调用
vi.mock('../../config', () => ({
  config: { useMock: false, generateTimeout: 90000 },
}))

import { apiPost } from '../../unit/request'
import { generateReading } from '../readings'

const PAYLOAD = { level: 'easy', targetWords: 100, questionCount: 5 }

describe('generateReading', () => {
  beforeEach(() => {
    apiPost.mockClear()
  })

  it('生成请求使用放开的超时', async () => {
    await generateReading(PAYLOAD)

    const [, , options] = apiPost.mock.calls[0]
    expect(options.timeout).toBe(90000)
  })

  it('调用方传 timeout 时覆盖默认值', async () => {
    await generateReading(PAYLOAD, { timeout: 5000 })

    const [, , options] = apiPost.mock.calls[0]
    expect(options.timeout).toBe(5000)
  })

  it('取消信号仍然透传', async () => {
    const controller = new AbortController()
    await generateReading(PAYLOAD, { signal: controller.signal })

    const [, , options] = apiPost.mock.calls[0]
    expect(options.signal).toBe(controller.signal)
  })
})
