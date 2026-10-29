/**
 * Vitest 配置
 * 复用 Vite 的 Vue 插件与 @ 别名，组件测试运行在 jsdom 环境。
 */
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.js'],
    // 单测断言的都是 mock 数据，必须与 .env 的 VITE_USE_MOCK 解耦：
    // 联调时会把它改成 false，若这里不锁定，整套测试会去打真实后端而全红。
    // 鉴权开关只表示后端契约（匿名 API 是否 401）；前端路由门禁已改为
    // meta.public 白名单（md/42），用例按需预置令牌或公开页 meta。
    env: { VITE_USE_MOCK: 'true', VITE_AUTH_ENFORCED: 'false' },
  },
})
