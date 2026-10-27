/**
 * 全局路由守卫
 * F1 只同步页面标题；答题页与结果页的数据校验在 F6 / F7 接入。
 */
const BASE_TITLE = 'Word Reading'

export function registerGuards(router) {
  router.afterEach((to) => {
    const pageTitle = to.meta.title
    document.title = pageTitle ? `${pageTitle} · ${BASE_TITLE}` : BASE_TITLE
  })
}
