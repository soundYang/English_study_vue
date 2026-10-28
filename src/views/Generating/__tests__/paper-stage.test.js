/**
 * 生成纸页测试
 * 锁住各阶段文案与动作：等待 / 校对 / 取正文可取消、失败与取消可返回、
 * 完成不再露出按钮；进度只按真实段数画格子，total 为 0 时不画。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import PaperStage from '../component/PaperStage.vue'

let wrapper = null

function mountStage(props = {}) {
  wrapper = mount(PaperStage, {
    props: { stage: 'waiting', ...props },
  })
  return wrapper
}

function findButton(text) {
  return wrapper.findAll('button').find((button) => button.text() === text)
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('PaperStage', () => {
  it('should show the waiting copy, parameters and a cancel button', async () => {
    mountStage({ summary: { level: 'hard', targetWords: 600 } })

    expect(wrapper.get('.paper-title').text()).toBe('一篇新的阅读，正在准备')
    expect(wrapper.get('.paper-hint').text()).toContain('正在为你写下一段新的阅读')
    expect(wrapper.get('.paper-meta').text()).toBe('难度：挑战 · 约 600 词')
    expect(wrapper.get('.paper-stage').attributes('aria-busy')).toBe('true')

    const cancel = findButton('取消生成')
    await cancel.trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('should switch from writing to proofreading copy without resetting the stage', async () => {
    mountStage()
    await wrapper.setProps({ stage: 'reviewing' })
    await nextTick()

    expect(wrapper.get('.paper-title').text()).toBe('一篇新的阅读，正在准备')
    expect(wrapper.get('.paper-hint').text()).toBe('正在校对这一次的稿子……')
    expect(wrapper.get('.paper-stage').attributes('aria-busy')).toBe('true')
  })

  it('should tell the user the article is ready while the page is fetched', async () => {
    mountStage()
    await wrapper.setProps({ stage: 'fetching' })
    await nextTick()

    expect(wrapper.get('.paper-title').text()).toBe('文章已经成形')
    expect(wrapper.get('.paper-hint').text()).toBe('文章已经成形，正在为你整理页面……')
  })

  it('should draw one cell per real segment and none before planning', async () => {
    mountStage({ progress: { done: 2, total: 5 } })

    expect(wrapper.findAll('.segment-cell')).toHaveLength(5)
    expect(wrapper.findAll('.segment-cell.is-filled')).toHaveLength(2)
    expect(wrapper.get('.segment-text').text()).toBe('已写 2 / 5 段')
    expect(wrapper.get('.segment-track').attributes('aria-label')).toBe('已写 2 / 5 段')

    await wrapper.setProps({ progress: { done: 0, total: 0 } })
    // 段数还没算出来时不能编进度
    expect(wrapper.find('.paper-progress').exists()).toBe(false)
  })

  it('should show the planned words as chips and drop them when done', async () => {
    mountStage({ selectedWords: [{ word: 'garden' }, { word: 'lantern' }] })

    expect(wrapper.findAll('.word-chip').map((chip) => chip.text())).toEqual(['garden', 'lantern'])

    await wrapper.setProps({ stage: 'done' })
    expect(wrapper.find('.paper-words').exists()).toBe(false)
  })

  it('should disable cancel while the cancel request is in flight', async () => {
    mountStage({ cancelling: true })

    const cancel = findButton('正在取消…')

    expect(cancel.attributes('disabled')).toBeDefined()
    expect(wrapper.get('.paper-hint').text()).toContain('正在停下这次生成')
  })

  it('should swap to the done copy without actions', async () => {
    mountStage()
    await wrapper.setProps({ stage: 'done' })
    await nextTick()

    expect(wrapper.get('.paper-title').text()).toBe('新的阅读，准备好了')
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.get('.paper-stage').attributes('aria-busy')).toBeUndefined()
  })

  it('should explain the failure and offer a way back', async () => {
    mountStage()
    await wrapper.setProps({ stage: 'failed' })
    await nextTick()

    expect(wrapper.get('.paper-title').text()).toBe('这次没能顺利完成')
    expect(wrapper.get('.paper-stage').attributes('aria-busy')).toBeUndefined()

    const back = findButton('返回设置')
    await back.trigger('click')

    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('should keep the written segments on the cancelled copy', async () => {
    mountStage({ progress: { done: 3, total: 6 } })
    await wrapper.setProps({ stage: 'cancelled' })
    await nextTick()

    expect(wrapper.get('.paper-title').text()).toBe('已暂停这次阅读准备')
    expect(wrapper.get('.segment-text').text()).toBe('已写 3 / 6 段')
    expect(findButton('返回设置')).toBeTruthy()
  })

  it('should show the paper immediately when resuming without replaying the entrance', async () => {
    mountStage({ skipEntrance: true })
    await nextTick()

    // skipEntrance 直接走 playResumed：纸页应为可见，而不是停在入场前的 autoAlpha 0
    expect(wrapper.get('.paper-stage').attributes('style')).toContain('opacity: 1')
  })
})
