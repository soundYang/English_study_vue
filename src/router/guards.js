/**
 * 全局路由守卫
 * 同步页面标题；答题页与结果页进入前拉取阅读详情。
 * 答题页：已提交替换到结果页；结果页：未提交替换回答题页。
 * 加载失败不阻断导航，由页面展示错误卡与重试，避免白屏。
 * 后台路由（meta.admin）走独立令牌：用户守卫放行，后台守卫决定去登录页还是概览。
 */
import { adminAuth } from '../admin/auth'
import { useReadingStore } from '../stores/model/reading'
import { localStore, storageKeys } from '../unit/storage'

const BASE_TITLE = 'Word Reading'

async function guardReading(to) {
  const id = String(to.params.id ?? '').trim()
  if (!id) return true

  try {
    const store = useReadingStore()
    const outcome = await store.ensureReading(id)
    if (outcome?.submitted) {
      return {
        name: 'reading-result',
        params: { id },
        replace: true,
      }
    }
  } catch {
    // Pinia 尚未安装或读取失败时放行，由页面自身处理加载与错误
  }

  return true
}

async function guardResult(to) {
  const id = String(to.params.id ?? '').trim()
  if (!id) return true

  try {
    const store = useReadingStore()
    const outcome = await store.ensureReading(id)
    if (outcome?.ok && outcome.submitted === false) {
      return {
        name: 'reading',
        params: { id },
        replace: true,
      }
    }
  } catch {
    // 加载失败或 Pinia 不可用时放行，由结果页展示错误卡
  }

  return true
}

/**
 * 未登录拦截：公开页白名单 + 其余默认拦截（md/42）。
 * 前端门禁不再跟随后端 VITE_AUTH_ENFORCED 开关，否则「游客浏览 + 功能登录」
 * 会在本地开发模式下失效；令牌是否有效仍由接口 401 兜底。
 */
function guardAuth(to) {
  // 后台有自己的令牌与登录页，不能被用户鉴权拦下（md/40 §1.3）
  if (to?.meta?.admin) return true
  // 登录 / 注册页本身
  if (to?.meta?.bare) return true
  // 首页、404 等显式公开页
  if (to?.meta?.public === true) return true
  // 默认：需要登录
  if (localStore.get(storageKeys.accessToken, '')) return true

  return {
    name: 'login',
    query: to.fullPath !== '/' ? { redirect: to.fullPath } : {},
  }
}

/**
 * 后台鉴权。
 * 只是 UX：令牌过期判断用本地 expiresAt，服务端 12 小时 TTL 仍是唯一权威；
 * 真过期时接口会 401，请求层清会话后由 AdminLayout 送回登录页。
 */
function guardAdmin(to) {
  if (!to?.meta?.admin) return true

  const hasToken = adminAuth.hasValidToken()

  if (to.name === 'admin-login') return hasToken ? { name: 'admin-overview' } : true
  return hasToken ? true : { name: 'admin-login', query: { redirect: to.fullPath } }
}

export function registerGuards(router) {
  router.beforeEach((to) => {
    const authRedirect = guardAuth(to)
    if (authRedirect !== true) return authRedirect

    const adminRedirect = guardAdmin(to)
    if (adminRedirect !== true) return adminRedirect

    if (to.name === 'reading') return guardReading(to)
    if (to.name === 'reading-result') return guardResult(to)
    return true
  })

  router.afterEach((to) => {
    const pageTitle = to.meta.title
    document.title = pageTitle ? `${pageTitle} · ${BASE_TITLE}` : BASE_TITLE
  })
}
