/**
 * 基础词表的展示映射
 * 分组 / 状态选项、卡片三态、类型徽标优先级与释义回退，全部是纯函数。
 * 组件里不再写 if 链，口径要改只改这里（见 md/16 §4.4）。
 */

/** 三个分组；顺序即标签顺序，值直接对应接口的 group 参数 */
export const BASIC_GROUPS = Object.freeze([
  { value: 'basic', label: '基础词' },
  { value: 'calendar', label: '日历词' },
  { value: 'abbreviation', label: '缩写' },
])

/** 状态筛选；值直接对应接口的 status 参数 */
export const BASIC_STATUS_OPTIONS = Object.freeze([
  { value: 'all', label: '全部状态' },
  { value: 'unknown', label: '未标记' },
  { value: 'known', label: '已知' },
  { value: 'removed', label: '不认识' },
])

/** 每页条数：100 是接口上限，50 给窄屏或想看得更细时用 */
export const BASIC_PAGE_SIZES = Object.freeze([100, 50])

export const BASIC_PAGE_SIZE_OPTIONS = Object.freeze(
  BASIC_PAGE_SIZES.map((size) => ({ value: size, label: `每页 ${size} 条` })),
)

const CALENDAR_TYPE_LABELS = Object.freeze({ weekday: '星期', month: '月份' })

/**
 * 卡片底部状态：设计稿只有三态，learning 与 mastered 合并成「已知」。
 * value 交给 StatusPill 定颜色（new 红 / mastered 绿 / 其余灰），label 覆盖默认文案。
 */
export function statusOf(item) {
  if (item.removed) return { value: 'new', label: '不认识' }
  if (item.personalStatus) return { value: 'mastered', label: '已知' }
  return { value: 'unknown', label: '未标记' }
}

/**
 * 类型徽标，返回 null 表示普通实词。
 * 优先级：功能词 > 缩写 > 日历词——may 的 kind 是 basic，但它是功能词，
 * 必须显示「文章必用」而不是「月份」。
 */
export function metaOf(item) {
  if (item.isFunctionWord) {
    return { label: '文章必用', hint: '功能词，文章里必须用到，不可移除' }
  }

  if (item.kinds?.includes('abbreviation')) {
    return { label: '缩写', hint: '系统收录的缩写，不可修改' }
  }

  if (item.kinds?.includes('calendar')) {
    return {
      label: CALENDAR_TYPE_LABELS[item.calendarType] || '日历词',
      hint: '由系统维护，不可修改',
    }
  }

  return null
}

/** 第三行的释义：优先用后端摘要，缩写与非词库词回退到首条义项 */
export function meaningOf(item) {
  if (item.summary) return item.summary
  return item.senses?.[0]?.meaning || ''
}

/**
 * 卡片菜单该显示什么：只读词返回 null（连菜单都不渲染），
 * 已在词库里的词给一条禁用说明，其余是删除 / 恢复二选一。
 */
export function menuActionOf(item) {
  if (!item.removable) return null
  if (item.removed) return { type: 'restore', label: '恢复为基础词' }
  if (item.personalStatus) return { type: 'locked', label: '已在词库中，去我的单词修改' }
  return { type: 'remove', label: '标为不认识' }
}
