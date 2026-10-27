/**
 * 历史记录页面测试
 * 覆盖统计卡、未提交记录、难度筛选、分页、记录跳转与两种空状态；
 * 使用真实 mock adapter（延迟 0），动效按 reduced-motion 直接显示终值。
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import HistoryPage from '../index.vue'
import { resetMockDb, setMockLatency } from '../../../mock/adapter'
import { countWords } from '../../../unit/format'
import { storageKeys } from '../../../unit/storage'

const ReadingStub = defineComponent({
  name: 'ReadingStub',
  template: '<div class="reading-stub">reading</div>',
})

const ResultStub = defineComponent({
  name: 'ResultStub',
  template: '<div class="result-stub">result</div>',
})

const SettingsStub = defineComponent({
  name: 'SettingsStub',
  template: '<div class="settings-stub">settings</div>',
})

const originalMatchMedia = window.matchMedia

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/history', name: 'history', component: HistoryPage },
      { path: '/readings/:id', name: 'reading', component: ReadingStub },
      { path: '/readings/:id/result', name: 'reading-result', component: ResultStub },
      { path: '/settings', name: 'settings', component: SettingsStub },
    ],
  })
}

async function mountHistory() {
  const router = createTestRouter()
  await router.push('/history')
  await router.isReady()

  const wrapper = mount(HistoryPage, {
    global: { plugins: [router] },
  })

  await flushPromises()
  return { wrapper, router }
}

function readDb() {
  return JSON.parse(localStorage.getItem(storageKeys.mockDb))
}

function writeDb(db) {
  localStorage.setItem(storageKeys.mockDb, JSON.stringify(db))
}

beforeEach(() => {
  localStorage.clear()
  resetMockDb()
  setMockLatency(0)

  // 统计数字直接显示终值，避免测试等待 900ms 动画
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})

afterAll(() => {
  window.matchMedia = originalMatchMedia
  setMockLatency(300)
})

describe('History page', () => {
  it('should render stats, records and the unsubmitted state', async () => {
    const db = readDb()
    const expectedWords = db.readings
      .filter((item) => item.status === 'submitted')
      .reduce((sum, item) => sum + countWords(item.article), 0)

    const { wrapper } = await mountHistory()

    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.get('h1').text()).toBe('历史记录')
    expect(wrapper.findAll('tbody tr.history-row')).toHaveLength(5)

    const rows = wrapper.findAll('tbody tr.history-row')
    expect(rows[0].text()).toContain('The Courage to Begin')
    expect(rows[0].text()).toContain('未提交')
    expect(rows[0].text()).toContain('继续答题')
    expect(rows[3].text()).toContain('The Garden Gate')
    expect(rows[3].text()).toContain('80%')

    expect(wrapper.findAll('.stat-value').map((node) => node.text())).toEqual([
      '4次',
      '82%',
      '100分',
      `${expectedWords}词`,
    ])

    expect(wrapper.text()).toContain('共 5 条')
    expect(wrapper.findAll('.history-card')).toHaveLength(5)
    expect(wrapper.get('.history-card').text()).toContain('未提交')
  })

  it('should filter by level without changing global stats', async () => {
    const { wrapper } = await mountHistory()

    await wrapper.get('.dropdown-trigger').trigger('click')
    await flushPromises()

    const hardOption = wrapper
      .findAll('.dropdown-option')
      .find((option) => option.text() === '挑战')
    await hardOption.trigger('click')
    await flushPromises()

    const rows = wrapper.findAll('tbody tr.history-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('The Courage to Begin')
    expect(wrapper.findAll('.stat-value')[0].text()).toBe('4次')
    expect(wrapper.text()).toContain('共 1 条')
  })

  it('should open the result page or continue answering according to status', async () => {
    const { wrapper, router } = await mountHistory()
    const rows = wrapper.findAll('tbody tr.history-row')

    await rows[0].get('.row-action').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/readings/r5')

    await router.push('/history')
    await flushPromises()

    const submittedRow = wrapper
      .findAll('tbody tr.history-row')
      .find((row) => row.text().includes('A Letter from the Coast'))
    await submittedRow.get('.row-action').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/readings/r4/result')
  })

  it('should paginate records and keep stats on the second page', async () => {
    const db = readDb()
    const template = db.readings.find((item) => item.status === 'submitted')

    for (let index = 0; index < 8; index += 1) {
      const copy = JSON.parse(JSON.stringify(template))
      copy.id = `rx${index}`
      copy.title = `${template.title} ${index + 1}`
      copy.createdAt = `2026-09-${String(index + 10).padStart(2, '0')}T08:00:00.000Z`
      db.readings.push(copy)
    }
    writeDb(db)

    const { wrapper } = await mountHistory()

    expect(wrapper.findAll('tbody tr.history-row')).toHaveLength(10)
    expect(wrapper.text()).toContain('共 13 条')
    expect(wrapper.text()).toContain('第 1 / 2 页')

    await wrapper.get('button[aria-label="下一页"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('tbody tr.history-row')).toHaveLength(3)
    expect(wrapper.text()).toContain('第 2 / 2 页')
    expect(wrapper.findAll('.stat-value')[0].text()).toBe('12次')
  })

  it('should guide an empty history to reading settings', async () => {
    const db = readDb()
    db.readings = []
    writeDb(db)

    const { wrapper, router } = await mountHistory()

    expect(wrapper.text()).toContain('还没有练习记录')

    const start = wrapper.findAll('button').find((button) => button.text() === '开始阅读')
    await start.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/settings')
  })

  it('should show the filtered empty state and return to all levels', async () => {
    const db = readDb()
    db.readings = db.readings.filter((item) => item.level === 'hard')
    writeDb(db)

    const { wrapper } = await mountHistory()

    await wrapper.get('.dropdown-trigger').trigger('click')
    await flushPromises()
    const easyOption = wrapper
      .findAll('.dropdown-option')
      .find((option) => option.text() === '简单')
    await easyOption.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('该难度下暂无记录')

    const viewAll = wrapper.findAll('button').find((button) => button.text() === '查看全部难度')
    await viewAll.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('tbody tr.history-row')).toHaveLength(1)
    expect(wrapper.text()).toContain('The Courage to Begin')
  })
})
