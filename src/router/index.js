/**
 * 路由表
 * 页面路由 + 404；meta.module 决定侧栏激活项，meta.hideMobileNav 控制底部标签栏，
 * meta.flush 取消内容区最大宽度与内边距（首页 Hero、设置页装饰栏、生成页纸舞台需要贴住窗口边缘）。
 */
import { createRouter, createWebHistory } from 'vue-router'
import { registerGuards } from './guards'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/Home/index.vue'),
    meta: { title: '首页', module: 'home', flush: true },
  },
  {
    path: '/words',
    name: 'words',
    component: () => import('../views/Words/index.vue'),
    meta: { title: '我的单词', module: 'words' },
  },
  {
    path: '/basic-words',
    name: 'basic-words',
    component: () => import('../views/BasicWords/index.vue'),
    meta: { title: '基础词汇库', module: 'basic-words' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/Settings/index.vue'),
    meta: { title: '阅读设置', module: 'reading', flush: true },
  },
  {
    path: '/generating',
    name: 'generating',
    component: () => import('../views/Generating/index.vue'),
    meta: { title: '正在生成', module: 'reading', flush: true },
  },
  {
    path: '/readings/:id',
    name: 'reading',
    component: () => import('../views/Reading/index.vue'),
    meta: { title: '阅读答题', module: 'reading', hideMobileNav: true, wide: true },
  },
  {
    path: '/readings/:id/result',
    name: 'reading-result',
    component: () => import('../views/Result/index.vue'),
    meta: { title: '练习结果', module: 'reading' },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('../views/History/index.vue'),
    meta: { title: '历史记录', module: 'history' },
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('../views/Profile/index.vue'),
    meta: { title: '个人中心', module: 'profile' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFound/index.vue'),
    meta: { title: '页面不存在' },
  },
]

// 开发期组件预览页：生产构建不注册，避免出现在正式路由表
if (import.meta.env.DEV) {
  routes.push({
    path: '/dev/components',
    name: 'component-preview',
    component: () => import('../views/Dev/index.vue'),
    meta: { title: '组件预览', module: '' },
  })
}

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})

registerGuards(router)

export default router
