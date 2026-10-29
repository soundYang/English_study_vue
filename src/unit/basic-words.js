/**
 * 基础词表的展示映射
 * 分组 / 状态选项、卡片三态、类型徽标优先级与释义回退，全部是纯函数。
 * 组件里不再写 if 链，口径要改只改这里（见 md/16 §4.4、md/52）。
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
  { value: 'known', label: '认识' },
  { value: 'removed', label: '不认识' },
])

/** 每页条数：100 是接口上限，50 给窄屏或想看得更细时用 */
export const BASIC_PAGE_SIZES = Object.freeze([100, 50])

export const BASIC_PAGE_SIZE_OPTIONS = Object.freeze(
  BASIC_PAGE_SIZES.map((size) => ({ value: size, label: `每页 ${size} 条` })),
)

const CALENDAR_TYPE_LABELS = Object.freeze({ weekday: '星期', month: '月份' })

/**
 * 卡片底部状态：只看个人的三态标记 personalState（md/52 §2.3）。
 * untouched → 未标记、known → 认识、removed → 不认识。
 * value 交给 StatusPill 定颜色（new 红 / mastered 绿 / 其余灰），label 覆盖默认文案。
 * 注意不再用 personalStatus 推断：它在词库中是学习中/已掌握，和这里的标记不是一回事。
 */
export function statusOf(item) {
  if (item.personalState === 'removed') return { value: 'new', label: '不认识' }
  if (item.personalState === 'known') return { value: 'mastered', label: '认识' }
  return { value: 'unknown', label: '未标记' }
}

/**
 * 类型徽标：每张卡片都有一个（md/52 §2.4），优先显示最能说明限制的那一类。
 * 优先级：功能词 > 缩写 > 日期词 > 基础词——may 的 kind 是 basic，但它是功能词，
 * 必须显示「文章必用」，而不是「基础词」。
 */
export function metaOf(item) {
  if (item.isFunctionWord) {
    return {
      label: '功能词',
      hint: '冠词、介词、连词、代词、情态动词等，文章里必须用到，不可移除',
    }
  }

  if (item.kinds?.includes('abbreviation')) {
    return { label: '缩写', hint: '系统收录的缩写，不可修改' }
  }

  if (item.kinds?.includes('calendar')) {
    const calendarLabel = CALENDAR_TYPE_LABELS[item.calendarType]
    return {
      label: '日期词',
      hint: calendarLabel ? `系统维护的${calendarLabel}，不可修改` : '由系统维护，不可修改',
    }
  }

  return { label: '基础词', hint: '可标为认识或不认识' }
}

/** 第三行的释义：优先用后端摘要，缩写与非词库词回退到首条义项 */
export function meaningOf(item) {
  if (item.summary) return item.summary
  return item.senses?.[0]?.meaning || ''
}

/**
 * 卡片菜单该显示什么：只读词返回 null（连菜单都不渲染）。
 * 其余返回动作数组，type 直接对应 PATCH 的 state：
 *   known / unknown / none 是三种可提交的状态，locked 是只读说明。
 * 口径见 md/52 §2.5：不认识可以改回认识，认识也可以退回不认识或取消。
 */
export function menuActionsOf(item) {
  if (!item.removable) return null

  if (item.personalState === 'removed') {
    return [
      { type: 'known', label: '标为认识' },
      { type: 'none', label: '取消标记' },
    ]
  }

  if (item.personalState === 'known') {
    // 词库里已有的词不归这里管，随便取消会让「我的单词」状态对不上
    if (item.knownSource === 'library') {
      return [{ type: 'locked', label: '已在词库中，去我的单词修改' }]
    }
    return [
      { type: 'unknown', label: '标为不认识' },
      { type: 'none', label: '取消认识' },
    ]
  }

  return [
    { type: 'known', label: '标为认识' },
    { type: 'unknown', label: '标为不认识' },
  ]
}
