/**
 * 错误归一化测试
 * 重点是 requestId：后端放在响应体顶层（不在 error 里），界面靠它显示「错误编号」。
 */
import { describe, expect, it } from 'vitest'
import { BusinessError, ServerError, normalizeApiError } from '..'

function axiosError(status, data) {
  return { response: { status, data } }
}

describe('normalizeApiError requestId', () => {
  it('should keep requestId from a business error response', () => {
    const error = normalizeApiError(
      axiosError(422, {
        error: { code: 'VOCABULARY_TOO_SMALL', message: '可用词不够' },
        requestId: 'req-7',
      }),
    )

    expect(error).toBeInstanceOf(BusinessError)
    expect(error.code).toBe('VOCABULARY_TOO_SMALL')
    expect(error.requestId).toBe('req-7')
  })

  it('should keep requestId when a 5xx also carries an error code', () => {
    // 后端 500 也带 error.code，因此先落进 BusinessError 分支——requestId 不能在这一步丢掉
    const error = normalizeApiError(
      axiosError(500, {
        error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
        requestId: 'req-9',
      }),
    )

    expect(error).toBeInstanceOf(BusinessError)
    expect(error.requestId).toBe('req-9')
  })

  it('should keep requestId when a 5xx has no error code', () => {
    const error = normalizeApiError(
      axiosError(502, { message: 'Bad Gateway', requestId: 'req-11' }),
    )

    expect(error).toBeInstanceOf(ServerError)
    expect(error.requestId).toBe('req-11')
  })

  it('should leave requestId empty when the payload has none', () => {
    // mock 抛的 MockApiError 没有 response，也就没有排查号；界面据此不渲染那一行
    const error = normalizeApiError({
      status: 404,
      error: { code: 'READING_NOT_FOUND', message: '这篇练习不存在或已被删除' },
    })

    expect(error.requestId).toBe('')
  })
})
