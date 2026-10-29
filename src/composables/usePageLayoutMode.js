/**
 * 页面内容区布局模式
 *
 * 用途：内容容器的宽度 / 内边距跟随路由（flush / wide），但延后到页面过渡入场时再切换。
 * 路由一变就套用目标页的布局时，`mode="out-in"` 的旧页面还在淡出，会被新容器重新排版：
 * 从居中窄列突然撑到满幅，看起来像旧页面先放大了一下，然后才切到新页面。
 *
 * 用法：
 *   const { layoutMode, syncLayoutMode } = usePageLayoutMode(route)
 *   <Transition name="page" mode="out-in" @before-enter="syncLayoutMode">
 *   <div :class="{ 'is-wide': layoutMode.wide, 'is-flush': layoutMode.flush }">
 */
import { computed, ref } from 'vue'

/** @param {import('vue-router').RouteLocationNormalizedLoaded} route 当前路由 */
export function usePageLayoutMode(route) {
  const wide = computed(() => route.meta.wide === true)
  const flush = computed(() => route.meta.flush === true)
  // 快照：离场期间保持旧值，入场钩子里才同步成目标路由
  const layoutMode = ref({ wide: wide.value, flush: flush.value })

  /** 旧页已离场、新页以 opacity: 0 插入时调用，此时切换布局用户看不见 */
  function syncLayoutMode() {
    layoutMode.value = { wide: wide.value, flush: flush.value }
  }

  return { layoutMode, syncLayoutMode }
}
