<script setup>
/**
 * 应用根组件
 * 登录 / 注册页（meta.bare）独立整屏渲染，其余页面统一由 AppLayout 承载。
 * 管理后台（meta.admin）由 AdminLayout 自己渲染侧栏，这里只给一个空壳。
 * 启动时如果本地有令牌，静默换一次用户资料，让顶栏与后端对齐。
 * 运行中请求收到 401 AUTH_REQUIRED 时清会话：公开页留在原地切游客态，
 * 受保护页才回登录页并保留 redirect（md/42）。
 */
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import AppLayout from './layouts/AppLayout.vue'
import { useAuthStore } from './stores/model/auth'
import { AUTH_EXPIRED_EVENT } from './unit/request'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const isBare = computed(() => route.meta.bare === true)
const isAdmin = computed(() => route.meta.admin === true)

function handleAuthExpired() {
  // 后台请求走独立客户端，不会广播用户掉线；这里仍然防御一次
  if (route.meta.bare || isAdmin.value) return

  const wasAuthenticated = auth.isAuthenticated
  auth.clearSession()

  // 本来就没有登录态：公开页上的 401 不需要再跳一次登录
  if (!wasAuthenticated) return

  // 登录过期后留在公开页，顶栏自然切成「登录 / 注册」
  if (route.meta.public) return

  router.replace({
    name: 'login',
    query: route.fullPath !== '/' ? { redirect: route.fullPath } : {},
  })
}

onMounted(() => {
  auth.restore()
  window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
})

onBeforeUnmount(() => {
  window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
})
</script>

<template>
  <RouterView v-if="isAdmin" />
  <RouterView v-else-if="isBare" />
  <AppLayout v-else />
</template>
