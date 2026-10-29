<script setup>
/**
 * 后台布局
 *
 * 用途：管理员后台的侧栏、顶栏与内容区。与用户端 AppLayout 共用 tokens，
 *       但不铺森林插画、不复用用户导航——后台的导航只有概览 / 用户台账 / 用户反馈。
 * 用法：由路由 `/admin` 的父级渲染，内部通过 RouterView 渲染子页面。
 *
 * 行为：
 *   - 桌面端固定 232px 侧栏；768–1023px 收为 76px 图标栏；< 768px 变顶部横向导航
 *   - 顶栏左侧显示当前页面名，右侧显示管理员与退出登录
 *   - 监听 `wr:admin-expired`：会话已被请求层清掉，这里把人送回登录页
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { LayoutDashboard, LogOut, MessageSquareText, ShieldCheck, Users } from 'lucide-vue-next'
import { adminLogout } from '../api/auth'
import { ADMIN_EXPIRED_EVENT } from '../api/http'
import { adminAuth } from '../auth'

const navItems = [
  { key: 'overview', label: '概览', to: '/admin', icon: LayoutDashboard },
  { key: 'users', label: '用户台账', to: '/admin/users', icon: Users },
  { key: 'feedback', label: '用户反馈', to: '/admin/feedback', icon: MessageSquareText },
]

const route = useRoute()
const router = useRouter()
const signingOut = ref(false)

// 子路由没有 module 元信息；按路径前缀判断，详情页也落在同一组
const activeSection = computed(() => {
  if (route.path.startsWith('/admin/users')) return 'users'
  if (route.path.startsWith('/admin/feedback')) return 'feedback'
  return 'overview'
})

const pageTitle = computed(() => route.meta.title || '管理后台')
const adminName = computed(() => adminAuth.username || '管理员')

function handleExpired() {
  // 令牌已由请求层清掉；这里只负责导航，避免请求层依赖 router
  router.replace({
    name: 'admin-login',
    query: route.fullPath.startsWith('/admin') ? { redirect: route.fullPath } : {},
  })
}

async function handleLogout() {
  if (signingOut.value) return
  signingOut.value = true

  try {
    await adminLogout()
  } catch {
    // 服务端是否成功撤销不该拦住本地退出；令牌之后不再使用
  } finally {
    adminAuth.clear()
    signingOut.value = false
    router.replace({ name: 'admin-login' })
  }
}

onMounted(() => {
  window.addEventListener(ADMIN_EXPIRED_EVENT, handleExpired)
})

onBeforeUnmount(() => {
  window.removeEventListener(ADMIN_EXPIRED_EVENT, handleExpired)
})
</script>

<template>
  <div class="admin-shell">
    <a class="skip-link" href="#admin-main">跳到主要内容</a>

    <aside class="sidebar">
      <RouterLink class="brand" to="/admin" aria-label="管理后台概览">
        <span class="brand-mark" aria-hidden="true">
          <ShieldCheck :size="18" :stroke-width="1.6" />
        </span>
        <span class="brand-text">
          <span class="brand-title">管理后台</span>
          <span class="brand-sub">Word Reading</span>
        </span>
      </RouterLink>

      <nav class="nav" aria-label="后台主导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.key"
          :to="item.to"
          class="nav-item"
          :class="{ 'is-active': activeSection === item.key }"
          :aria-label="item.label"
          :aria-current="activeSection === item.key ? 'page' : undefined"
          :title="item.label"
        >
          <component :is="item.icon" :size="18" :stroke-width="1.7" aria-hidden="true" />
          <span class="nav-label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <p class="sidebar-note">只读台账 · 访问留痕</p>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <div class="topbar-inner">
          <h1 class="topbar-title">{{ pageTitle }}</h1>

          <div class="topbar-actions">
            <span class="admin-name">{{ adminName }}</span>
            <button type="button" class="logout" :disabled="signingOut" @click="handleLogout">
              <LogOut :size="16" :stroke-width="1.7" aria-hidden="true" />
              <span>{{ signingOut ? '正在退出…' : '退出登录' }}</span>
            </button>
          </div>
        </div>
      </header>

      <main id="admin-main" class="main" tabindex="-1">
        <div class="main-inner">
          <RouterView v-slot="{ Component }">
            <Transition name="page" mode="out-in">
              <component :is="Component" />
            </Transition>
          </RouterView>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  display: flex;
  height: 100dvh;
  overflow: hidden;
  background: var(--color-bg);
}

.skip-link {
  position: fixed;
  top: var(--space-2);
  left: var(--space-2);
  z-index: calc(var(--z-toast) + 1);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: var(--color-primary-ink);
  font-size: var(--text-small);
  transform: translateY(-160%);
  transition: transform var(--dur-fast) var(--ease-out);
}

.skip-link:focus-visible {
  transform: translateY(0);
}

/* 侧栏：用户端的尺寸与激活态，纯色底不铺插画 */
.sidebar {
  position: relative;
  z-index: var(--z-sidebar);
  display: flex;
  flex: 0 0 var(--sidebar-width);
  flex-direction: column;
  width: var(--sidebar-width);
  height: 100dvh;
  padding: 28px 20px 20px;
  background: var(--color-sidebar);
  color: var(--color-sidebar-text);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 8px 28px;
  border-radius: var(--radius-md);
}

.brand-mark {
  display: grid;
  flex: 0 0 38px;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: rgba(237, 231, 217, 0.08);
}

.brand-title {
  display: block;
  font-family: var(--font-display);
  font-size: 18px;
  line-height: 24px;
  letter-spacing: 0.01em;
}

.brand-sub {
  display: block;
  margin-top: 2px;
  color: var(--color-sidebar-muted);
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.08em;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: 40px;
  padding: 0 var(--space-3);
  border-radius: 10px;
  color: var(--color-sidebar-muted);
  font-size: 14px;
  line-height: 20px;
  transition:
    color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-sidebar-text);
}

.nav-item.is-active {
  background: var(--color-sidebar-text);
  color: var(--color-sidebar);
}

.nav-item.is-active::before {
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 0;
  width: 2px;
  border-radius: 2px;
  background: var(--color-accent);
  content: '';
}

.sidebar-note {
  margin-top: auto;
  padding: 0 8px;
  color: var(--color-sidebar-muted);
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.08em;
}

/* 工作区 */
.workspace {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  height: 100dvh;
}

.topbar {
  flex: 0 0 var(--topbar-height);
  height: var(--topbar-height);
  border-bottom: 1px solid var(--color-line);
  padding: 0 var(--space-10);
}

.topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  width: 100%;
  max-width: var(--content-max-wide);
  height: 100%;
  margin: 0 auto;
}

.topbar-title {
  min-width: 0;
  overflow: hidden;
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 28px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.admin-name {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.logout {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-ink-2);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  transition:
    background-color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.logout:hover:not(:disabled) {
  border-color: var(--color-line-strong);
  background: var(--color-surface-2);
  color: var(--color-ink);
}

.logout:disabled {
  cursor: progress;
  opacity: 0.6;
}

.logout:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.main-inner {
  width: 100%;
  max-width: var(--content-max-wide);
  margin: 0 auto;
  padding: var(--content-pad-y) var(--space-10) var(--space-16);
}

@media (max-width: 1279px) {
  .topbar {
    padding: 0 var(--space-8);
  }

  .main-inner {
    padding: var(--space-8) var(--space-8) var(--space-16);
  }
}

/* 平板：侧栏收为图标栏 */
@media (min-width: 768px) and (max-width: 1023px) {
  .sidebar {
    flex-basis: var(--sidebar-width-compact);
    align-items: center;
    width: var(--sidebar-width-compact);
    padding: 24px 12px 16px;
  }

  .brand {
    justify-content: center;
    padding: 0 0 24px;
  }

  .brand-text,
  .nav-label,
  .sidebar-note {
    display: none;
  }

  .nav {
    width: 100%;
  }

  .nav-item {
    justify-content: center;
    padding: 0;
  }
}

/* 手机：侧栏改为顶部横向导航，表格与详情各自横向滚动 */
@media (max-width: 767px) {
  .admin-shell {
    flex-direction: column;
  }

  .sidebar {
    flex: 0 0 auto;
    flex-direction: row;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    height: auto;
    padding: 10px 16px;
  }

  .brand {
    flex: 0 0 auto;
    padding: 0;
  }

  .brand-mark {
    width: 32px;
    height: 32px;
  }

  .brand-text,
  .sidebar-note {
    display: none;
  }

  .nav {
    flex: 1;
    flex-direction: row;
    gap: var(--space-1);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .nav::-webkit-scrollbar {
    display: none;
  }

  .nav-item {
    flex: 0 0 auto;
    gap: 6px;
    height: 36px;
    padding: 0 var(--space-3);
    font-size: var(--text-caption);
    white-space: nowrap;
  }

  .nav-item.is-active::before {
    display: none;
  }

  .workspace {
    height: auto;
    min-height: 0;
  }

  .topbar {
    flex-basis: 56px;
    height: 56px;
    padding: 0 16px;
  }

  .topbar-title {
    font-size: 18px;
    line-height: 26px;
  }

  .admin-name {
    display: none;
  }

  .main-inner {
    padding: var(--space-5) 16px var(--space-12);
  }
}
</style>
