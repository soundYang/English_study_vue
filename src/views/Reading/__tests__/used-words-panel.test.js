/**
 * 本文用到的词面板测试
 * 覆盖空数组不渲染、按 kind 分组、次数展示、pool 二次折叠与未知 kind 的兜底；
 * 数据口径见 md/56 §15：数组已由后端排好，组件不排序、不查状态。
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UsedWordsPanel from '../component/UsedWordsPanel.vue'

const WORDS = [
  { word: 'courage', count: 3, kind: 'focus' },
  { word: 'language', count: 1, kind: 'target' },
  { word: 'patient', count: 2, kind: 'pool' },
  // 后端未来若加了新 kind，前端按 pool 处理，不能整组丢掉
  { word: 'mystery', count: 1, kind: 'unknown' },
]

function mountPanel(props = {}) {
  return mount(UsedWordsPanel, { props })
}

describe('UsedWordsPanel', () => {
  it('should render nothing when the article has no used words', () => {
    expect(mountPanel({ words: [] }).find('.used-words').exists()).toBe(false)
    expect(mountPanel().find('.used-words').exists()).toBe(false)
  })

  it('should keep the backend order and group words by kind', async () => {
    const wrapper = mountPanel({ words: WORDS })
    const toggle = wrapper.get('.used-toggle')

    expect(toggle.text()).toContain('本文用到了 4 个你的单词')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.used-body').exists()).toBe(false)

    await toggle.trigger('click')

    expect(toggle.attributes('aria-expanded')).toBe('true')
    const labels = wrapper.findAll('.group-label').map((node) => node.text())
    expect(labels).toEqual(['重点词', '目标词', '顺带复习的 2 个词'])

    // 同一组内保持入参顺序，前端不重排
    expect(wrapper.findAll('.chip.is-focus').map((node) => node.text())).toEqual(['courage'])
    expect(wrapper.findAll('.chip.is-target').map((node) => node.text())).toEqual(['language'])
    expect(wrapper.findAll('.chip.is-pool').map((node) => node.text())).toEqual([
      'patient',
      'mystery',
    ])
  })

  it('should show the occurrence count next to each word', async () => {
    const wrapper = mountPanel({ words: WORDS })
    await wrapper.get('.used-toggle').trigger('click')

    const counts = wrapper.findAll('.chip-count')
    expect(counts.map((node) => node.text())).toEqual(['×3', '×1', '×2', '×1'])
    expect(counts[0].attributes('aria-label')).toBe('出现 3 次')
  })

  it('should nest the pool group inside a collapsed details block', async () => {
    const wrapper = mountPanel({ words: WORDS })
    await wrapper.get('.used-toggle').trigger('click')

    const pool = wrapper.get('details.pool')
    expect(pool.attributes('open')).toBeUndefined()
    expect(pool.get('summary').text()).toBe('顺带复习的 2 个词')
    // 即使收起也在 DOM 里，展开时不额外请求
    expect(pool.text()).toContain('patient')
  })

  it('should drop blank words and still count the rest', async () => {
    const wrapper = mountPanel({
      words: [
        { word: '  ', count: 2, kind: 'focus' },
        { word: 'garden', count: 0, kind: 'target' },
      ],
    })

    expect(wrapper.get('.used-toggle').text()).toContain('本文用到了 1 个你的单词')
    await wrapper.get('.used-toggle').trigger('click')
    // count 缺失 / 0 时至少显示一次，不能出现 ×0
    expect(wrapper.get('.chip-count').text()).toBe('×1')
  })
})
