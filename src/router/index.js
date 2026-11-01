/**
 * 路由表
 * 页面路由 + 404；meta.module 决定侧栏激活项，meta.hideMobileNav 控制底部标签栏，
 * meta.flush 取消内容区最大宽度与内边距（首页 Hero、设置页装饰栏、生成页纸舞台需要贴住窗口边缘）。
 * 鉴权默认拦截：meta.public 与 meta.guestMode 的页面允许游客进入，
 * 未标注的新路由仍要求登录；登录 / 注册页用 meta.bare。
 */
import { createRouter, createWebHistory } from 'vue-router'
import { registerGuards } from './guards'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/Home/index.vue'),
    // 游客落地页：只展示公共内容，不请求个人接口（md/42）
    meta: { title: '首页', module: 'home', flush: true, public: true },
  },
  {
    path: '/words',
    name: 'words',
    component: () => import('../views/Words/index.vue'),
    // 游客可进：页面用遮罩展示结构（md/45）
    meta: { title: '我的单词', module: 'words', guestMode: 'browse' },
  },
  {
    path: '/words/review',
    name: 'words-review',
    component: () => import('../views/WordsReview/index.vue'),
    // 复习队列属于账号数据：不写 guestMode，未登录默认被拦去登录页
    meta: { title: '今日复习', module: 'words' },
  },
  {
    path: '/basic-words',
    name: 'basic-words',
    component: () => import('../views/BasicWords/index.vue'),
    // 公开只读词表，游客可浏览（md/45 §5.3）
    meta: { title: '基础词汇库', module: 'basic-words', guestMode: 'browse' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/Settings/index.vue'),
    meta: { title: '阅读设置', module: 'reading', flush: true, guestMode: 'browse' },
  },
  {
    path: '/generating',
    name: 'generating',
    component: () => import('../views/Generating/index.vue'),
    // 游客没有生成参数，页面自己回落到设置页（md/45 §3.4）
    meta: { title: '正在生成', module: 'reading', flush: true, guestMode: 'redirect' },
  },
  {
    path: '/readings/:id',
    name: 'reading',
    component: () => import('../views/Reading/index.vue'),
    meta: {
      title: '阅读答题',
      module: 'reading',
      hideMobileNav: true,
      wide: true,
      guestMode: 'gate',
    },
  },
  {
    path: '/readings/:id/result',
    name: 'reading-result',
    component: () => import('../views/Result/index.vue'),
    meta: { title: '练习结果', module: 'reading', guestMode: 'gate' },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('../views/History/index.vue'),
    meta: { title: '历史记录', module: 'history', guestMode: 'browse' },
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('../views/Profile/index.vue'),
    meta: { title: '个人中心', module: 'profile', guestMode: 'browse' },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Auth/index.vue'),
    // bare：不套侧栏与顶栏，登录 / 注册页是独立整屏（md/33 §11）
    meta: { title: '登录', bare: true, authMode: 'login' },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/Auth/index.vue'),
    meta: { title: '注册', bare: true, authMode: 'register' },
  },
  // 管理后台：独立布局与独立会话（md/40）；必须放在 404 通配之前
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('../admin/views/Login.vue'),
    meta: { admin: true, bare: true, title: '后台登录' },
  },
  {
    path: '/admin',
    component: () => import('../admin/layouts/AdminLayout.vue'),
    meta: { admin: true },
    children: [
      {
        path: '',
        name: 'admin-overview',
        component: () => import('../admin/views/Overview.vue'),
        meta: { title: '概览' },
      },
      {
        path: 'users',
        name: 'admin-users',
        component: () => import('../admin/views/Users.vue'),
        meta: { title: '用户台账' },
      },
      {
        path: 'users/:dataKey',
        name: 'admin-user',
        component: () => import('../admin/views/UserDetail.vue'),
        meta: { title: '用户详情' },
      },
      {
        path: 'feedback',
        name: 'admin-feedback',
        component: () => import('../admin/views/Feedback.vue'),
        meta: { title: '用户反馈' },
      },
      {
        path: 'feedback/:id',
        name: 'admin-feedback-detail',
        component: () => import('../admin/views/FeedbackDetail.vue'),
        meta: { title: '反馈详情' },
      },
      {
        path: 'logs',
        name: 'admin-logs',
        component: () => import('../admin/views/Logs.vue'),
        meta: { title: '日志' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFound/index.vue'),
    // 输错网址不应该被送去登录，404 本身就是公开页
    meta: { title: '页面不存在', public: true },
  },
]

// 开发期组件预览页：生产构建不注册，避免出现在正式路由表
if (import.meta.env.DEV) {
  routes.push({
    path: '/dev/components',
    name: 'component-preview',
    component: () => import('../views/Dev/index.vue'),
    meta: { title: '组件预览', module: '', public: true },
  })
}

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    // 带锚点时滚到目标（个人中心 #api-settings）：卡片是异步渲染的，
    // vue-router 会轮询等元素出现；top 留出顶栏高度
    if (to.hash) return { el: to.hash, top: -72 }
    return { top: 0 }
  },
})

registerGuards(router)

export default router
