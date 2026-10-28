/**
 * 全局路由守卫
 * 同步页面标题；答题页与结果页进入前拉取阅读详情。
 * 答题页：已提交替换到结果页；结果页：未提交替换回答题页。
 * 加载失败不阻断导航，由页面展示错误卡与重试，避免白屏。
 */
import { config } from '../config'
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
 * 未登录拦截。
 * 只在 VITE_AUTH_ENFORCED=true 时生效——后端默认 false（回落 local-user），
 * 前端若强行拦路由，会让现在这套「不登录也能用」的开发方式直接坏掉（md/33 §7.3）。
 */
function guardAuth(to) {
  // 测试会直接构造只带 params 的 to；meta 缺失按普通页面处理即可
  if (to?.meta?.bare || !config.authEnforced) return true
  if (localStore.get(storageKeys.accessToken, '')) return true

  return {
    name: 'login',
    query: to.fullPath !== '/' ? { redirect: to.fullPath } : {},
  }
}

export function registerGuards(router) {
  router.beforeEach((to) => {
    const authRedirect = guardAuth(to)
    if (authRedirect !== true) return authRedirect

    if (to.name === 'reading') return guardReading(to)
    if (to.name === 'reading-result') return guardResult(to)
    return true
  })

  router.afterEach((to) => {
    const pageTitle = to.meta.title
    document.title = pageTitle ? `${pageTitle} · ${BASE_TITLE}` : BASE_TITLE
  })
}
