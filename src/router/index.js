/**
 * 路由表
 * 六页闭环 + 404；meta.module 决定侧栏激活项，meta.hideMobileNav 控制底部标签栏。
 */
import { createRouter, createWebHistory } from 'vue-router'
import { registerGuards } from './guards'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/Home/index.vue'),
    meta: { title: '首页', module: 'home' },
  },
  {
    path: '/words',
    name: 'words',
    component: () => import('../views/Words/index.vue'),
    meta: { title: '我的单词', module: 'words' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/Settings/index.vue'),
    meta: { title: '阅读设置', module: 'reading' },
  },
  {
    path: '/readings/:id',
    name: 'reading',
    component: () => import('../views/Reading/index.vue'),
    meta: { title: '阅读答题', module: 'reading', hideMobileNav: true },
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
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFound/index.vue'),
    meta: { title: '页面不存在' },
  },
]

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
