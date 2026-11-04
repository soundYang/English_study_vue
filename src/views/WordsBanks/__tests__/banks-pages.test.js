/**
 * 词库总览 / 详情页面测试
 * 覆盖卡片与入口、目录选择、导入所选、已导入 Tab 的批量改状态与重置。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import Overview from '../index.vue'
import Detail from '../Detail.vue'
import { resetMockDb, setMockLatency } from '../../../mock/adapter'
import { addWordsToBank } from '../../../api/word-banks'
import { useToastStore } from '../../../stores/model/toast'
import { useWordBanksStore } from '../../../stores/model/word-banks'
import { localStore, storageKeys } from '../../../unit/storage'

const Blank = { template: '<div />' }
let wrapper = null

beforeEach(() => {
  localStorage.clear()
  localStore.set(storageKeys.accessToken, 'sess_banks_page')
  resetMockDb()
  setMockLatency(0)
})

afterEach(() => {
  if (wrapper) wrapper.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

async function mountAt(path) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/words', name: 'words', component: Blank },
      { path: '/words/banks', name: 'words-banks', component: Overview },
      { path: '/words/banks/:bank', name: 'words-bank-detail', component: Detail },
      { path: '/basic-words', name: 'basic-words', component: Blank },
    ],
  })
  await router.push(path)
  await router.isReady()

  const component = path.includes('/banks/') ? Detail : Overview
  wrapper = mount(component, {
    attachTo: document.body,
    global: {
      plugins: [pinia, router],
      stubs: { teleport: true, 'transition-group': false },
    },
  })
  await flushPromises()
  return { router, pinia }
}

function wordRow(word) {
  return wrapper.get(`.bank-word[data-word="${word}"]`)
}

describe('Word banks overview', () => {
  it('should show both banks, the shared slot count and the basic words entry', async () => {
    await mountAt('/words/banks')

    expect(wrapper.findAll('.bank-card')).toHaveLength(2)
    expect(wrapper.text()).toContain('高频词库')
    expect(wrapper.text()).toContain('中频词库')
    expect(wrapper.text()).toContain('个人词库还剩')
    expect(wrapper.get('.basic-entry').attributes('href')).toBe('/basic-words')
  })

  it('should open the bank detail from the pick button', async () => {
    const { router } = await mountAt('/words/banks')

    const pick = wrapper
      .findAll('.card-actions button')
      .find((button) => button.text().includes('去挑选'))
    await pick.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('words-bank-detail')
    expect(router.currentRoute.value.params.bank).toBe('high')
  })

  it('should confirm and reset a bank from the overview', async () => {
    await addWordsToBank('high', { words: ['abandon'] })
    await mountAt('/words/banks')
    const store = useWordBanksStore()
    const toasts = useToastStore()

    expect(wrapper.text()).toContain('已导入')

    await wrapper.get('.reset-bank').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('只移除从该词库导入的词，你自己原有的词不受影响。')

    const confirm = wrapper
      .findAll('button')
      .filter((button) => button.text() === '重置词库')
      .at(-1)
    await confirm.trigger('click')
    await flushPromises()

    expect(store.banks[0].imported).toBe(0)
    expect(toasts.items.map((item) => item.message)).toContain(
      '已重置高频词库：移除 1 个词，保留 0 个',
    )
  })
})

describe('Word bank detail', () => {
  it('should list the catalog and mark user-owned words', async () => {
    await mountAt('/words/banks/high')

    expect(wrapper.findAll('.bank-word').length).toBeGreaterThan(0)
    // apple 原本就在个人词库里，但不是从词库导入的
    expect(wordRow('apple').text()).toContain('已在词库（原有）')
    expect(wordRow('abandon').text()).toContain('未导入')
  })

  it('should select and import words, then show them under the imported tab', async () => {
    await mountAt('/words/banks/high')
    const store = useWordBanksStore()

    await wordRow('abandon').get('input[type="checkbox"]').setValue(true)
    expect(wrapper.get('.selected-count').text()).toBe('已选 1 个')

    const importButton = wrapper
      .findAll('button')
      .find((button) => button.text().startsWith('导入所选'))
    await importButton.trigger('click')
    await flushPromises()

    expect(store.importedCount).toBe(1)
    expect(wrapper.find('.bank-word[data-word="abandon"]').exists()).toBe(false)

    await wrapper.findAll('.bank-tab')[1].trigger('click')
    await flushPromises()

    expect(wordRow('abandon').text()).toContain('新词')
    expect(store.notImportedCount).toBe(store.bank.total - 1)
  })

  it('should batch change imported status without dropping the row', async () => {
    await addWordsToBank('high', { words: ['abandon'] })
    await mountAt('/words/banks/high')
    const store = useWordBanksStore()

    await wrapper.findAll('.bank-tab')[1].trigger('click')
    await flushPromises()

    await wordRow('abandon').get('input[type="checkbox"]').setValue(true)
    await wrapper.get('select.batch-target').setValue('removed')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '应用')
      .trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('把选中的 1 个词标为「已排除」？')
    const confirm = wrapper
      .findAll('button')
      .filter((button) => button.text() === '标为已排除')
      .at(-1)
    await confirm.trigger('click')
    await flushPromises()

    // 「已排除」是学习状态，导入记录仍在，行不能消失
    expect(wordRow('abandon').text()).toContain('已排除')
    expect(store.importedCount).toBe(1)
  })

  it('should reset the bank from the detail header', async () => {
    await addWordsToBank('high', { words: ['abandon'] })
    await mountAt('/words/banks/high')
    const store = useWordBanksStore()

    await wrapper.get('.reset-bank').trigger('click')
    await flushPromises()
    const confirm = wrapper
      .findAll('button')
      .filter((button) => button.text() === '重置词库')
      .at(-1)
    await confirm.trigger('click')
    await flushPromises()

    expect(store.importedCount).toBe(0)
    expect(wordRow('abandon').text()).toContain('未导入')
  })
})
