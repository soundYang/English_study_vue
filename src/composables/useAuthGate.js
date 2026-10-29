/**
 * 操作级登录门禁
 *
 * 用途：公开页上的业务按钮（如首页「开始阅读」）在执行副作用前判断登录态。
 *       路由链接不需要手动包一层，交给 router/guards.js 的默认拦截。
 * 用法：
 *   const { requireAuth, goLogin } = useAuthGate()
 *   requireAuth(() => startReading(), { redirect: '/settings' })
 *
 * 说明：未登录时只跳登录页并返回 false，不执行 action；调用方不需要再写 else。
 */
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/model/auth'

export function useAuthGate() {
  const auth = useAuthStore()
  const router = useRouter()
  const route = useRoute()

  function goLogin(redirect = route.fullPath) {
    let target = typeof redirect === 'string' ? redirect.trim() : ''

    // 登录 / 注册页不能再作为回跳目标，否则会绕回表单
    const path = target.split(/[?#]/)[0]
    if (path === '/login' || path === '/register') target = ''

    router.push({
      name: 'login',
      query: target && target !== '/' ? { redirect: target } : {},
    })
  }

  /**
   * 已登录：执行 action；未登录：去登录页，不执行 action。
   * 返回 false 时调用方应立即 return，避免继续走后面的业务分支。
   */
  function requireAuth(action, { redirect = route.fullPath } = {}) {
    if (auth.isAuthenticated) {
      action?.()
      return true
    }

    goLogin(redirect)
    return false
  }

  return { isGuest: () => !auth.isAuthenticated, requireAuth, goLogin }
}
