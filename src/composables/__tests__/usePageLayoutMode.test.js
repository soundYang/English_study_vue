/**
 * 页面布局模式测试
 * 重点验证：路由已经变化、但页面还没入场时，容器继续使用旧布局，
 * 避免离场中的旧页面被新页面的宽度 / 内边距重新排版。
 */
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { usePageLayoutMode } from '../usePageLayoutMode'

describe('usePageLayoutMode', () => {
  it('should keep the previous layout until the page enters', () => {
    const route = reactive({ meta: { flush: true, wide: false } })
    const { layoutMode, syncLayoutMode } = usePageLayoutMode(route)

    expect(layoutMode.value).toEqual({ wide: false, flush: true })

    // 路由已经切到普通页面，但旧页面还在淡出：布局先保持不变
    route.meta = { flush: false, wide: false }
    expect(layoutMode.value).toEqual({ wide: false, flush: true })

    // 新页面入场时再同步
    syncLayoutMode()
    expect(layoutMode.value).toEqual({ wide: false, flush: false })
  })

  it('should fall back to the normal layout when meta has no flags', () => {
    const route = reactive({ meta: {} })
    const { layoutMode, syncLayoutMode } = usePageLayoutMode(route)

    route.meta = { flush: true, wide: true }
    syncLayoutMode()

    expect(layoutMode.value).toEqual({ wide: true, flush: true })

    route.meta = {}
    syncLayoutMode()

    expect(layoutMode.value).toEqual({ wide: false, flush: false })
  })
})
