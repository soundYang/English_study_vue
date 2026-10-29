/**
 * 词汇文件解析接口测试
 * 锁住 multipart 字段名、超时与 Content-Type 清理：
 * 共享 axios 默认 application/json，FormData 必须把这个头清掉，否则会被 JSON 化。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../unit/request', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn().mockResolvedValue({ source: 'txt', rows: [] }),
}))

vi.mock('../../config', () => ({
  config: { useMock: false, importTimeout: 30000 },
}))

import { apiPost } from '../../unit/request'
import { extractWordImport } from '../words'

describe('extractWordImport', () => {
  beforeEach(() => {
    apiPost.mockClear()
  })

  it('should send the file in a multipart field named file', async () => {
    const file = new File(['apple 苹果'], 'words.txt', { type: 'text/plain' })

    await extractWordImport(file)

    const [url, form, options] = apiPost.mock.calls[0]
    expect(url).toBe('/words/import/extract')
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('file')).toBe(file)
    expect(options.timeout).toBe(30000)
  })

  it('should clear the shared JSON content type so the browser adds the boundary', async () => {
    await extractWordImport(new File(['apple'], 'words.txt', { type: 'text/plain' }))

    const [, , options] = apiPost.mock.calls[0]
    expect(options.headers['Content-Type']).toBeUndefined()
  })
})
