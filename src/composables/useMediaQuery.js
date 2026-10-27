/**
 * 媒体查询组合式函数
 * 用法：const isWide = useMediaQuery('(min-width: 1200px)')
 * 用于“右栏常驻 / 抽屉”这类需要 JS 参与决策的断点判断；
 * 纯样式切换优先使用 CSS 媒体查询。jsdom 等无 matchMedia 环境返回 false。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useMediaQuery(query) {
  const matches = ref(false)

  let mediaQueryList = null

  function handleChange(event) {
    matches.value = event.matches
  }

  onMounted(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    mediaQueryList = window.matchMedia(query)
    matches.value = mediaQueryList.matches
    mediaQueryList.addEventListener('change', handleChange)
  })

  onBeforeUnmount(() => {
    mediaQueryList?.removeEventListener('change', handleChange)
    mediaQueryList = null
  })

  return matches
}
