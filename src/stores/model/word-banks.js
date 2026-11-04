/**
 * 可选词库状态（md/22 §11、md/55 §6.3）
 * 管理词库概要、目录分页 / 搜索 / Tab、整库分批导入进度、批量改状态与重置。
 * 导入 / 重置会改动个人词库，成功后顺带让 words store 静默对账，避免「我的单词」残留已删词。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  addWordsToBank,
  batchUpdateBankStatus,
  fetchWordBankWords,
  fetchWordBanks,
  resetWordBank,
} from '../../api/word-banks'
import { normalizeApiError } from '../../errors'
import { useWordsStore } from './words'

/** 整库导入单批上限：与后端 addWordsToBankSchema 的 limit 上限一致 */
export const BANK_IMPORT_BATCH = 500
export const BANK_PAGE_SIZE = 50

export const useWordBanksStore = defineStore('word-banks', () => {
  const banks = ref([])
  const banksLoading = ref(false)
  const banksError = ref('')

  // 当前详情页的词库：{ key, label, total }
  const bank = ref(null)
  const items = ref([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(BANK_PAGE_SIZE)
  // 默认看「未导入」：进入词库就是为了挑词
  const tab = ref('not_imported')
  const query = ref('')
  const listLoading = ref(false)
  const listError = ref('')
  const hasLoaded = ref(false)
  // 整库导入进度；null 表示没有在导入。running=false 时保留最后结果供页面展示
  const importProgress = ref(null)

  let listSeq = 0

  const hasItems = computed(() => items.value.length > 0)
  const bankByKey = computed(() => {
    const map = new Map()
    banks.value.forEach((item) => map.set(item.key, item))
    return map
  })
  // 「已导入 / 未导入」Tab 的数字：已导入读概要，未导入 = 目录总量 − 已导入
  const importedCount = computed(() => bankByKey.value.get(bank.value?.key)?.imported ?? 0)
  const notImportedCount = computed(() =>
    Math.max(0, (bank.value?.total ?? 0) - importedCount.value),
  )

  function toFailure(caught) {
    const normalized = normalizeApiError(caught)

    return {
      ok: false,
      errors: normalized?.field ? { [normalized.field]: normalized.message } : {},
      message: normalized?.message || '网络出了点问题，请稍后重试。',
      code: normalized?.code || '',
    }
  }

  /** 拉取两个词库的概要 */
  async function fetchBanks({ quiet = false } = {}) {
    if (!quiet) {
      banksLoading.value = true
      banksError.value = ''
    }

    try {
      const data = await fetchWordBanks()
      banks.value = data?.banks || []
      banksLoading.value = false
      return { ok: true, data }
    } catch (caught) {
      banksLoading.value = false
      const failure = toFailure(caught)
      if (!quiet) banksError.value = failure.message
      return failure
    }
  }

  /** 拉取当前词库目录；写操作后的对账传 quiet，避免整页闪骨架 */
  async function fetchList(bankKey = bank.value?.key, { quiet = false } = {}) {
    if (!bankKey) {
      return { ok: false, errors: {}, message: '请先选择词库。', code: 'INVALID_REQUEST' }
    }

    const current = (listSeq += 1)
    if (!quiet) {
      listLoading.value = true
      listError.value = ''
    }

    try {
      const result = await fetchWordBankWords(bankKey, {
        page: page.value,
        pageSize: pageSize.value,
        q: query.value,
        filter: tab.value === 'imported' ? 'imported' : 'not_imported',
      })

      if (current !== listSeq) return { ok: true, stale: true }

      bank.value = result.bank
      items.value = result.items || []
      total.value = result.total ?? 0
      page.value = result.page ?? 1
      pageSize.value = result.pageSize ?? BANK_PAGE_SIZE
      listLoading.value = false
      hasLoaded.value = true
      return { ok: true, data: result }
    } catch (caught) {
      if (current !== listSeq) return { ok: false, stale: true }

      listLoading.value = false
      const failure = toFailure(caught)
      if (!quiet) {
        listError.value = failure.message
        items.value = []
        total.value = 0
        hasLoaded.value = false
      }
      return failure
    }
  }

  /**
   * 进入词库详情
   * 换词库时回到「未导入 / 第 1 页 / 无搜索」；同一个词库再次进入保留
   * 来源 Tab / 页码 / 搜索词（md/22 §11.3 第 1 条）。
   */
  async function openBank(bankKey) {
    const sameBank = bank.value?.key === bankKey && hasLoaded.value

    if (!sameBank) {
      bank.value = { key: bankKey, label: '', total: 0 }
      tab.value = 'not_imported'
      query.value = ''
      page.value = 1
      hasLoaded.value = false
      items.value = []
      total.value = 0
    }

    return fetchList(bankKey)
  }

  async function setTab(value) {
    tab.value = value === 'imported' ? 'imported' : 'not_imported'
    page.value = 1
    return fetchList()
  }

  async function search(value) {
    query.value = String(value ?? '').trim()
    page.value = 1
    return fetchList()
  }

  async function goToPage(value) {
    page.value = Math.max(1, Number(value) || 1)
    return fetchList()
  }

  /** 词库改动后同步「我的单词」：只在对方已经加载过时对账，避免多打一次无意义请求 */
  async function refreshWords() {
    const words = useWordsStore()

    if (words.hasLoaded) await words.fetchList({ quiet: true })
    if (words.dailyPlan) await words.loadDailyPlan({ quiet: true })
  }

  async function refreshAfterMutation() {
    const tasks = [fetchBanks({ quiet: true })]
    // 总览页没有打开任何词库：只刷新概要，不去猜一个目录
    if (bank.value?.key) tasks.push(fetchList(undefined, { quiet: true }))
    await Promise.all(tasks)
    await refreshWords()
  }

  /** 导入显式勾选的词 */
  async function importWords(words) {
    if (!bank.value?.key) {
      return { ok: false, errors: {}, message: '请先选择词库。', code: 'INVALID_REQUEST' }
    }

    try {
      const data = await addWordsToBank(bank.value.key, { words, status: 'learning' })
      await refreshAfterMutation()
      return { ok: true, ...data }
    } catch (caught) {
      return toFailure(caught)
    }
  }

  /**
   * 整库分批导入
   *
   * 按 cursor 串行请求，单批 500；任一请求失败就停在当前进度，
   * 已导入的词不会回滚（与后端「已成功的部分保留」一致）。
   */
  async function importAll() {
    const bankKey = bank.value?.key
    if (!bankKey) {
      return { ok: false, errors: {}, message: '请先选择词库。', code: 'INVALID_REQUEST' }
    }

    const progress = {
      running: true,
      done: 0,
      total: bank.value.total || 0,
      created: 0,
      existing: 0,
      alreadyImported: 0,
      failed: 0,
      skipped: [],
      limitReached: false,
      remainingSlots: null,
    }
    importProgress.value = progress

    let cursor = 0
    try {
      for (;;) {
        const data = await addWordsToBank(bankKey, {
          all: true,
          limit: BANK_IMPORT_BATCH,
          cursor,
        })

        progress.created += data?.created || 0
        progress.existing += data?.existing || 0
        progress.alreadyImported += data?.alreadyImported || 0
        progress.failed += data?.failed || 0
        progress.skipped.push(...(data?.skipped || []))
        progress.done += data?.requested || 0
        progress.remainingSlots = data?.remainingSlots ?? progress.remainingSlots
        progress.limitReached = data?.limitReached === true

        if (data?.done || progress.limitReached) break
        // 防御：cursor 没有前进说明后端语义变了，继续循环只会打满限流
        if (!Number.isInteger(data?.nextCursor) || data.nextCursor <= cursor) break
        cursor = data.nextCursor
      }

      progress.running = false
      await refreshAfterMutation()
      return { ok: true, data: progress }
    } catch (caught) {
      progress.running = false
      const failure = toFailure(caught)
      // 已经导入的部分也要让页面看到；失败信息由视图提示
      return { ...failure, data: progress }
    }
  }

  /** 批量改「已导入」词的状态；标为不认识后仍留在已导入 Tab */
  async function batchStatus(words, target) {
    if (!bank.value?.key) {
      return { ok: false, errors: {}, message: '请先选择词库。', code: 'INVALID_REQUEST' }
    }

    try {
      const data = await batchUpdateBankStatus(bank.value.key, { words, target })
      await refreshAfterMutation()
      return { ok: true, ...data }
    } catch (caught) {
      return toFailure(caught)
    }
  }

  /** 重置词库：只删导入记录与由此新建的词；总览页不进入详情，可显式传 key */
  async function resetBank(bankKey = bank.value?.key) {
    if (!bankKey) {
      return { ok: false, errors: {}, message: '请先选择词库。', code: 'INVALID_REQUEST' }
    }

    try {
      const data = await resetWordBank(bankKey)
      await refreshAfterMutation()
      return { ok: true, ...data }
    } catch (caught) {
      return toFailure(caught)
    }
  }

  function reset() {
    listSeq += 1
    banks.value = []
    banksError.value = ''
    bank.value = null
    items.value = []
    total.value = 0
    page.value = 1
    tab.value = 'not_imported'
    query.value = ''
    listError.value = ''
    hasLoaded.value = false
    importProgress.value = null
  }

  return {
    banks,
    banksLoading,
    banksError,
    bank,
    items,
    total,
    page,
    pageSize,
    tab,
    query,
    listLoading,
    listError,
    hasLoaded,
    importProgress,
    hasItems,
    bankByKey,
    importedCount,
    notImportedCount,
    fetchBanks,
    fetchList,
    openBank,
    setTab,
    search,
    goToPage,
    importWords,
    importAll,
    batchStatus,
    resetBank,
    reset,
  }
})
