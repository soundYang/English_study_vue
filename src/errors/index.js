/**
 * 分层错误体系
 * 区分用户可理解的业务异常与网络/认证/服务器异常，供 store 与视图分别处理。
 * Mock 与真实接口共用同一套错误类型，切换后端时视图层无需改动。
 */

/**
 * 业务异常 — 用户可理解的预期错误，带错误码与可选字段名
 * requestId 来自响应体顶层（后端 errorHandler 加的排查号），mock 没有，为空串
 */
export class BusinessError extends Error {
  constructor(message, code = 'BUSINESS_ERROR', options = {}) {
    super(message)
    this.name = 'BusinessError'
    this.code = code
    this.field = options.field || ''
    this.details = options.details || {}
    this.requestId = options.requestId || ''
  }
}

/** 网络异常 — 请求未到达或响应未返回 */
export class NetworkError extends Error {
  constructor(message = '网络出了点问题，请稍后重试。', status = 0) {
    super(message)
    this.name = 'NetworkError'
    this.status = status
  }
}

/** 认证异常 — token 过期；MVP 无登录页，由调用方决定后续导航 */
export class AuthError extends NetworkError {
  constructor(message = '登录已过期') {
    super(message, 401)
    this.name = 'AuthError'
  }
}

/** 服务器异常 — 后端 5xx */
export class ServerError extends NetworkError {
  constructor(message = '服务器错误', status = 500, requestId = '') {
    super(message, status)
    this.name = 'ServerError'
    this.requestId = requestId
  }
}

/**
 * 把任意请求错误归一化为上述错误类型
 * 支持 axios 错误（response.data.error）、mock 抛出的 MockApiError（error 字段）
 * 以及已归一化的错误；取消请求保持原样，交给调用方判断。
 */
export function normalizeApiError(error) {
  if (error instanceof BusinessError || error instanceof NetworkError) return error
  if (error?.name === 'AbortError' || error?.name === 'CanceledError') return error

  const payload = error?.error || error?.response?.data?.error
  const status = error?.status || error?.response?.status || 0
  const message = payload?.message || ''
  // 后端把 requestId 放在响应体顶层，不在 error 里。404 / 400（JSON 解析失败）/
  // 413 自 2026-10-29 起也带了（md/45 L4），所以这里对三类响应一视同仁地取
  const requestId = error?.response?.data?.requestId || ''

  if (payload?.code) {
    // details 是后端 422 的结构化上下文（required / available / kind…），
    // 丢了它覆盖层就只能说「词不够」，说不出差多少、该缩篇幅还是加词
    return new BusinessError(message || '请求失败', payload.code, {
      field: payload.field || '',
      details: payload.details || {},
      requestId,
    })
  }

  if (!error?.response && !error?.error) {
    return new NetworkError('网络出了点问题，请稍后重试。')
  }
  if (status === 401) return new AuthError()
  if (status >= 500) {
    return new ServerError(message || '服务器错误', status, requestId)
  }
  if (status >= 400) {
    return new BusinessError(message || '请求失败', 'INVALID_REQUEST', { requestId })
  }

  return new NetworkError(message || '网络出了点问题，请稍后重试。', status)
}
