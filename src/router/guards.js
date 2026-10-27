/**
 * 全局路由守卫
 * 同步页面标题；答题页与结果页进入前拉取阅读详情。
 * 答题页：已提交替换到结果页；结果页：未提交替换回答题页。
 * 加载失败不阻断导航，由页面展示错误卡与重试，避免白屏。
 */
import { useReadingStore } from '../stores/model/reading'

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

export function registerGuards(router) {
  router.beforeEach((to) => {
    if (to.name === 'reading') return guardReading(to)
    if (to.name === 'reading-result') return guardResult(to)
    return true
  })

  router.afterEach((to) => {
    const pageTitle = to.meta.title
    document.title = pageTitle ? `${pageTitle} · ${BASE_TITLE}` : BASE_TITLE
  })
}
