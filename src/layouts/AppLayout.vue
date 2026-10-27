<script setup>
/**
 * 应用布局
 *
 * 用途：承载全站侧栏、顶部用户标识、内容区与移动端底部标签栏
 * 用法：<AppLayout />，内部通过 RouterView 渲染页面
 *
 * 行为：
 *   - 桌面端固定 232px 侧栏，内容区独立滚动
 *   - 768～1023px 侧栏收为 76px 图标栏
 *   - 小于 768px 时侧栏隐藏，改为顶部栏 + 底部四标签
 *   - 答题页通过 meta.hideMobileNav 隐藏底部标签，避免误触离开
 */
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { BookOpen, Clock, Home, NotebookPen } from 'lucide-vue-next'
import GenerateOverlay from '../component/GenerateOverlay.vue'
import ToastHost from '../component/ToastHost.vue'

const navItems = [
  { key: 'home', label: '首页', to: '/', icon: Home },
  { key: 'words', label: '我的单词', to: '/words', icon: BookOpen },
  { key: 'reading', label: '阅读训练', to: '/settings', icon: NotebookPen },
  { key: 'history', label: '历史记录', to: '/history', icon: Clock },
]

const route = useRoute()
const mainRef = ref(null)
const activeModule = computed(() => route.meta.module || '')
const hideMobileNav = computed(() => route.meta.hideMobileNav === true)

watch(
  () => route.fullPath,
  () => {
    if (mainRef.value) mainRef.value.scrollTop = 0
  },
)
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">跳到主要内容</a>

    <aside class="sidebar">
      <RouterLink class="brand" to="/" aria-label="Word Reading 首页">
        <span class="brand-mark" aria-hidden="true">
          <BookOpen :size="20" :stroke-width="1.6" />
        </span>
        <span class="brand-text">
          <span class="brand-title">Word Reading</span>
          <span class="brand-sub">AI 英语阅读训练</span>
        </span>
      </RouterLink>

      <nav class="nav" aria-label="主导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.key"
          :to="item.to"
          class="nav-item"
          :class="{ 'is-active': activeModule === item.key }"
          :aria-label="item.label"
          :aria-current="activeModule === item.key ? 'page' : undefined"
          :title="item.label"
        >
          <component :is="item.icon" :size="18" :stroke-width="1.7" aria-hidden="true" />
          <span class="nav-label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <p class="sidebar-quote">Little by little,<br />you will get there.</p>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <div class="topbar-inner">
          <RouterLink class="topbar-brand" to="/" aria-label="Word Reading 首页">
            <BookOpen :size="18" :stroke-width="1.7" aria-hidden="true" />
            <span>Word Reading</span>
          </RouterLink>
          <div class="topbar-user">
            <span class="user-avatar" aria-hidden="true">S</span>
            <span class="user-name">Sound</span>
          </div>
        </div>
      </header>

      <main id="main-content" ref="mainRef" class="main">
        <div class="main-inner">
          <RouterView v-slot="{ Component }">
            <Transition name="page" mode="out-in">
              <component :is="Component" />
            </Transition>
          </RouterView>
        </div>
      </main>

      <nav v-if="!hideMobileNav" class="mobile-tabs" aria-label="移动端主导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.key"
          :to="item.to"
          class="mobile-tab"
          :class="{ 'is-active': activeModule === item.key }"
          :aria-label="item.label"
          :aria-current="activeModule === item.key ? 'page' : undefined"
        >
          <component :is="item.icon" :size="20" :stroke-width="1.7" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </div>

    <ToastHost />
    <GenerateOverlay />
  </div>
</template>

<style scoped>
.app-shell {
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

/* 侧栏 */
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

.sidebar-quote {
  margin-top: auto;
  padding: 20px 10px 4px;
  color: var(--color-sidebar-text);
  font-family: var(--font-display);
  font-size: 12px;
  font-style: italic;
  line-height: 20px;
  opacity: 0.55;
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
  padding: 0 var(--content-pad-x);
}

.topbar-inner {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  max-width: var(--content-max);
  height: 100%;
  margin: 0 auto;
}

.topbar-brand {
  display: none;
}

.topbar-user {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.user-avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-sidebar);
  color: var(--color-sidebar-text);
  font-family: var(--font-display);
  font-size: var(--text-caption);
}

.main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.main-inner {
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--content-pad-y) var(--content-pad-x) var(--space-16);
}

/* 移动端底部标签栏（桌面隐藏） */
.mobile-tabs {
  display: none;
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
  .sidebar-quote {
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

/* 手机：顶部栏 + 底部标签 */
@media (max-width: 767px) {
  .sidebar {
    display: none;
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: var(--z-topbar);
    flex-basis: var(--mobile-topbar-height);
    height: var(--mobile-topbar-height);
    padding: 0 20px;
    border-bottom: 1px solid var(--color-line);
    background: var(--color-bg);
  }

  .topbar-inner {
    justify-content: space-between;
  }

  .topbar-brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-ink);
    font-family: var(--font-display);
    font-size: 16px;
    letter-spacing: 0.01em;
  }

  .main-inner {
    padding-bottom: calc(var(--content-pad-y) + var(--mobile-tabbar-height) + var(--space-6));
  }

  .mobile-tabs {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: var(--z-tabbar);
    display: flex;
    height: calc(var(--mobile-tabbar-height) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    border-top: 1px solid var(--color-line);
    background: rgba(255, 252, 246, 0.96);
    backdrop-filter: blur(10px);
  }

  .mobile-tab {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 44px;
    color: var(--color-muted);
    font-size: 11px;
    line-height: 16px;
    transition: color var(--dur-fast) var(--ease-out);
  }

  .mobile-tab.is-active {
    color: var(--color-primary);
  }
}

@media (max-width: 479px) {
  .user-name {
    display: none;
  }
}
</style>
