/**
 * Vite 构建配置
 * 提供 @ 路径别名与本地开发服务器设置，测试环境复用同一别名。
 * 生产构建按 VITE_USE_MOCK 决定是否把 Mock 数据源整块换成占位模块（md/40 H-2）。
 */
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

const adapterId = fileURLToPath(new URL('./src/mock/adapter.js', import.meta.url))
const mockStubId = fileURLToPath(new URL('./src/mock/disabled.js', import.meta.url))

/**
 * 把对 mock/adapter 的引用换成占位模块
 * 只在 build + VITE_USE_MOCK=false 时挂上：adapter.js 里既有演示账号又有整套种子数据，
 * 真实后端的产物里不该留任何一份。开发与测试仍走真 Mock，行为不变。
 */
function stripMockAdapter() {
  return {
    name: 'wr-strip-mock-adapter',
    enforce: 'pre',
    async resolveId(source, importer) {
      // 只看形如 `../mock/adapter` / `../../mock/adapter` 的引用，别误伤别处的同名文件
      if (!/(^|\/)mock\/adapter(\.js)?$/.test(source)) return null

      const resolved = await this.resolve(source, importer, { skipSelf: true })
      if (!resolved?.id.replace(/\\/g, '/').endsWith('/mock/adapter.js')) return null

      return mockStubId
    },
  }
}

export default defineConfig(({ command, mode }) => {
  // 与 src/config/index.js 用同一个判据：只有显式 false 才算「用真实后端」
  const env = loadEnv(mode, process.cwd(), '')
  const useMock = env.VITE_USE_MOCK !== 'false'
  const plugins = [vue()]

  if (command === 'build') {
    if (useMock) {
      // 不中断构建：本地演示包仍需要 Mock。但要让打包的人看见「这份产物带着演示账号」
      console.warn(
        '[build] VITE_USE_MOCK 未设为 false：产物仍包含 Mock 数据源与演示账号（md/40 H-2）。',
      )
    } else {
      plugins.push(stripMockAdapter())
    }
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      // 监听所有网卡，局域网内其它设备（手机 / 另一台电脑）才能打开 dev 地址。
      // 默认只绑 localhost，此时 http://<本机IP>:5173 是连不上的。
      host: true,
      port: 5173,
      open: false,
    },
  }
})
