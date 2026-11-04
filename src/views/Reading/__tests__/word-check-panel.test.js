/**
 * 交卷前单词确认面板测试
 * 覆盖默认勾选、只提交改动行、未收录词补录、墓碑恢复与查询失败降级。
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import WordCheckPanel from '../component/WordCheckPanel.vue'
import { resetMockDb, setMockLatency } from '../../../mock/adapter'
import { batchUpdateWordStatus, batchWords, checkWords as realCheckWords } from '../../../api/words'

const flags = vi.hoisted(() => ({ failCheck: false }))

vi.mock('../../../api/words', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    checkWords: (...args) =>
      flags.failCheck
        ? Promise.reject({ error: { message: '网络出了点问题' } })
        : actual.checkWords(...args),
  }
})

let wrapper = null

beforeEach(() => {
  localStorage.clear()
  resetMockDb()
  setMockLatency(0)
  flags.failCheck = false
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

afterAll(() => {
  setMockLatency(300)
})

async function mountPanel(words) {
  const pinia = createPinia()
  setActivePinia(pinia)

  wrapper = mount(WordCheckPanel, {
    props: { open: true, words },
    global: { plugins: [pinia], stubs: { teleport: true } },
  })
  await flushPromises()
  return wrapper
}

function row(word) {
  return wrapper.get(`.word-row[data-word="${word}"]`)
}

async function toggle(word) {
  await row(word)
    .get('input[type="checkbox"]')
    .setValue(!row(word).get('input[type="checkbox"]').element.checked)
  await flushPromises()
}

async function confirm() {
  const button = wrapper.findAll('button').find((item) => item.text().includes('确认并提交'))
  await button.trigger('click')
  await flushPromises()
}

async function statusOf(word) {
  const data = await realCheckWords([word])
  return data.items[0]
}

describe('WordCheckPanel', () => {
  it('should check words already in the library and leave uncollected words unchecked', async () => {
    await mountPanel([{ word: 'apple' }, { word: 'quiet' }, { word: 'abandon' }])

    expect(row('apple').get('input[type="checkbox"]').element.checked).toBe(true)
    expect(row('quiet').get('input[type="checkbox"]').element.checked).toBe(true)
    expect(row('abandon').get('input[type="checkbox"]').element.checked).toBe(false)
    expect(wrapper.get('.check-count').text()).toContain('认识 2 / 3')
    expect(row('abandon').text()).toContain('不在词库')
  })

  it('should mark only the unchecked word as removed', async () => {
    await mountPanel([{ word: 'apple' }, { word: 'quiet' }])

    await toggle('apple')
    await confirm()

    const apple = await statusOf('apple')
    const quiet = await statusOf('quiet')

    expect(apple.source).toBe('basic-removed')
    // 默认勾选的行不能重写，避免把 nextReviewAt 整批重置
    expect(quiet.status).toBe('learning')
    expect(wrapper.emitted('submit')).toEqual([[{ changed: true }]])
  })

  it('should add a checked uncollected word to the library', async () => {
    await mountPanel([{ word: 'abandon' }])

    await toggle('abandon')
    await confirm()

    const abandon = await statusOf('abandon')
    expect(abandon.exists).toBe(true)
    expect(abandon.source).toBe('dictionary')
    expect(abandon.status).toBe('learning')
  })

  it('should restore a tombstone instead of setting learning directly', async () => {
    await batchWords({ words: [{ word: 'abandon' }] })
    const created = await statusOf('abandon')
    await batchUpdateWordStatus({ ids: [created.wordId], target: 'removed' })

    await mountPanel([{ word: 'abandon' }])
    expect(row('abandon').get('input[type="checkbox"]').element.checked).toBe(false)
    expect(row('abandon').text()).toContain('恢复')

    await toggle('abandon')
    await confirm()

    const restored = await statusOf('abandon')
    expect(restored.source).toBe('dictionary')
    expect(restored.status).toBe('learning')
  })

  it('should fall back to direct submit when the status query fails', async () => {
    flags.failCheck = true
    await mountPanel([{ word: 'apple' }])

    expect(wrapper.get('.check-error').text()).toContain('单词状态查询失败')
    expect(wrapper.get('.check-error').text()).toContain('仍可以直接提交')

    const direct = wrapper.findAll('button').find((item) => item.text().trim() === '直接提交')
    await direct.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('submit')).toEqual([[{ changed: false }]])

    // 查询失败时不能动词库；恢复真实查询后再核对
    flags.failCheck = false
    expect((await statusOf('apple')).source).toBe('dictionary')
  })
})
