/**
 * 学习统计卡测试
 * 覆盖四指标口径（次 / 天 / 轮）、30 格热力图的档位与读屏文案、游客遮罩与缺口提示。
 * 数据形状见后端 md/56 P3：heatmap 已补满 30 天，前端不排序、不补格子。
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StudyStats from '../component/StudyStats.vue'

const HEATMAP = Array.from({ length: 30 }, (_, index) => {
  const day = String(index + 3).padStart(2, '0')
  return {
    date: `2026-10-${day}`,
    reviewed: index % 5 === 0 ? 4 : index % 3 === 0 ? 1 : 0,
    mastered: index % 5 === 0 ? 1 : 0,
  }
})

const STATS = {
  date: '2026-11-01',
  streak: 5,
  today: { reviewed: 12, mastered: 3 },
  total: { reviewed: 340, mastered: 20 },
  mastery: { count: 8, avgStage: 1.8 },
  pendingReview: 4,
  heatmap: HEATMAP,
}

function mountStats(props = {}) {
  return mount(StudyStats, { props })
}

describe('StudyStats', () => {
  it('should render the four metrics with their units', () => {
    const wrapper = mountStats({ stats: STATS })

    const labels = wrapper.findAll('.metric-label').map((node) => node.text())
    expect(labels).toEqual(['连续复习', '今日复习', '累计复习', '平均掌握'])

    const values = wrapper.findAll('.metric-number').map((node) => node.text())
    expect(values).toEqual(['5', '12', '340', '1.8'])

    expect(wrapper.findAll('.metric-unit').map((node) => node.text())).toEqual([
      '天',
      '次',
      '次',
      '轮',
    ])
    expect(wrapper.text()).toContain('共 8 个已掌握词')
    expect(wrapper.text()).toContain('累计掌握 20 个词')
  })

  it('should always state the data starts when the feature went live', () => {
    const wrapper = mountStats({ stats: STATS })

    expect(wrapper.get('.study-caveat').text()).toBe('统计从功能上线之日起记录')
  })

  it('should render 30 heatmap cells scaled against the busiest day', () => {
    const wrapper = mountStats({ stats: STATS })
    const cells = wrapper.findAll('.heatmap-cell')

    expect(cells).toHaveLength(30)
    // 最大 4 次 → 该格满档；0 次 → 底灰
    expect(cells[0].classes()).toContain('is-level-4')
    expect(cells[1].classes()).toContain('is-level-0')
    expect(cells[0].attributes('title')).toBe('10-03 · 复习 4 次')
    expect(cells[0].attributes('aria-label')).toBe('10-03 · 复习 4 次')
    expect(wrapper.get('.heatmap').attributes('aria-label')).toContain('共复习')
  })

  it('should mask the metrics and hide the heatmap for guests', () => {
    const wrapper = mountStats({ masked: true })

    expect(wrapper.findAll('.guest-mask')).toHaveLength(4)
    expect(wrapper.find('.heatmap').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('340')
    // 游客也要看到这行，登录后才知道数据从哪开始
    expect(wrapper.text()).toContain('统计从功能上线之日起记录')
  })

  it('should fall back to zeros when the stats object is missing fields', () => {
    const wrapper = mountStats({ stats: { today: {}, total: {}, mastery: {}, heatmap: [] } })

    expect(wrapper.findAll('.metric-number').map((node) => node.text())).toEqual([
      '0',
      '0',
      '0',
      '0',
    ])
    expect(wrapper.find('.heatmap').exists()).toBe(false)
    expect(wrapper.text()).toContain('还没有复习记录')
  })
})
