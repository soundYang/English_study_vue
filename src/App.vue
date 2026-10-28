<script setup>
/**
 * 应用根组件
 * 登录 / 注册页（meta.bare）独立整屏渲染，其余页面统一由 AppLayout 承载。
 * 启动时如果本地有令牌，静默换一次用户资料，让顶栏与后端对齐。
 * 运行中请求收到 401 AUTH_REQUIRED 时清会话并回登录页，避免停在一张全是错误的页面上。
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

function handleAuthExpired() {
  if (route.meta.bare) return

  auth.clearSession()
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
  <RouterView v-if="isBare" />
  <AppLayout v-else />
</template>
