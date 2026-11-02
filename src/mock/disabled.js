/**
 * Mock 数据源占位（生产构建专用）
 *
 * 用途：`VITE_USE_MOCK=false` 的构建里，vite.config.js 的 `wr-strip-mock`
 *       会把所有对 `mock/adapter`、`mock/dictionary` 的引用改成这里，
 *       演示账号、整份种子数据与开发用手写词表因此不会进 dist（md/40 H-2）。
 * 用法：源码里不要 import 本文件，只由构建期插件替换进来。
 *
 * 约定：导出名必须与 adapter.js 一致，否则替换后会在 `import` 阶段直接报错；
 *       实现一律「访问即抛错」——生产环境走到 Mock 分支本身就是 bug，不该静默返回假数据。
 */

/** 任何属性访问都返回一个抛错函数；调用 Mock 方法即说明数据源开关配错了 */
function unavailable(feature) {
  const fail = () => {
    throw new Error(`[mock] ${feature} 在生产构建中不可用：该构建已设置 VITE_USE_MOCK=false`)
  }

  return new Proxy({}, { get: () => fail })
}

/** 演示账号：登录页只在开发环境展示，这里留空串，避免密码随包发布 */
export const MOCK_DEMO_CREDENTIALS = Object.freeze({ username: '', password: '' })

export const mockProfile = unavailable('profile')

export const mockApiKey = unavailable('apiKey')

export const mockFeedback = unavailable('feedback')

export const mockAuth = unavailable('auth')

export const mockWords = unavailable('words')

export const mockReadings = unavailable('readings')

export const mockQuota = unavailable('quota')

export const mockDictionary = unavailable('dictionary')
