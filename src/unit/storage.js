/**
 * 本地存储封装
 * 统一处理 JSON 序列化、存储不可用（隐私模式）与配额不足，调用方无需写 try/catch。
 * 存储不可用时自动降级为内存存储，并在控制台提示一次，避免静默丢数据。
 */

const memoryFallback = new Map()
let hasWarned = false

function warnOnce(message) {
  if (hasWarned) return
  hasWarned = true
  if (typeof console !== 'undefined') console.warn(`[storage] ${message}`)
}

function resolveBackend(getBackend) {
  try {
    const backend = getBackend()
    const probeKey = '__wr_storage_probe__'
    backend.setItem(probeKey, '1')
    backend.removeItem(probeKey)
    return backend
  } catch {
    warnOnce('浏览器存储不可用，已降级为内存存储，刷新后数据会丢失。')
    return null
  }
}

function createStore(getBackend) {
  let backend = null
  let isResolved = false

  function store() {
    if (!isResolved) {
      backend = resolveBackend(getBackend)
      isResolved = true
    }
    return backend
  }

  return {
    /** 读取并反序列化；不存在或解析失败时返回默认值 */
    get(key, fallbackValue = null) {
      const target = store()
      try {
        const raw = target ? target.getItem(key) : memoryFallback.get(key)
        if (raw == null) return fallbackValue
        return JSON.parse(raw)
      } catch {
        warnOnce(`读取 ${key} 失败，已返回默认值。`)
        return fallbackValue
      }
    },

    /** 序列化并写入；写入失败时退化为内存存储并返回 false */
    set(key, value) {
      const raw = JSON.stringify(value)
      const target = store()
      try {
        if (target) target.setItem(key, raw)
        else memoryFallback.set(key, raw)
        return true
      } catch {
        warnOnce(`写入 ${key} 失败，已降级为内存存储。`)
        memoryFallback.set(key, raw)
        return false
      }
    },

    remove(key) {
      const target = store()
      try {
        if (target) target.removeItem(key)
        else memoryFallback.delete(key)
      } catch {
        memoryFallback.delete(key)
      }
    },
  }
}

export const localStore = createStore(() => globalThis.localStorage)
export const sessionStore = createStore(() => globalThis.sessionStorage)

/** 集中维护存储键，避免各页面拼字符串导致读写不一致 */
export const storageKeys = {
  settings: 'wr.settings.v1',
  // v2 起单词带 source / phonetic / senses，旧键数据不再读取
  mockDb: 'wr.mock.db.v2',
  dictionarySuggest: 'wr.pref.dictionarySuggest',
  // 登录页福利条被关掉后不再反复出现（只存一个布尔值）
  loginPromoDismissed: 'wr.pref.loginPromoDismissed.v1',
  // 生成任务 id 必须在刷新后还能读到：回来直接 GET 续上轮询（后端 md/32 §5）
  generationTask: 'wr.generation.task.v1',
  // 个人资料与 Mock 阅读库分开存：改昵称不需要让整套种子数据重建（md/33 §6）
  mockProfile: 'wr.mock.profile.v1',
  // 自备 API Key 的本地模拟（md/43）：按用户 id 分桶，只存掩码不存明文
  mockApiKey: 'wr.mock.apikey.v1',
  // 会话令牌：request.js 请求拦截器直接读这个键（键名沿用历史，勿改）
  accessToken: 'accessToken',
  // 缓存最近一次的用户资料，刷新页面时顶栏先显示昵称，不必等接口
  authUser: 'wr.auth.user.v1',
  // Mock 的账号表与会话：真实后端没有这两个键（md/33 §6）
  mockAuthUsers: 'wr.mock.auth.users.v1',
  mockAuthSession: 'wr.mock.auth.session.v1',
  // 设备标识：生成一次后长期复用，随每个请求带 X-Device-Id（md/35 §3.3）
  deviceId: 'wr_device_id',
  answers: (readingId) => `wr.answers:${readingId}`,
  timer: (readingId) => `wr.timer:${readingId}`,
}
