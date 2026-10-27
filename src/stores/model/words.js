/**
 * 词汇状态
 * 管理词汇列表的查询条件、分页、计数与增删改，视图不直接调用 api/words。
 * 写操作成功后做一次静默刷新，保证列表、总数与 counts 与后端一致；
 * 请求失败统一归一化为 { code, message, field }，字段错误交给表单展示。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createWord,
  deleteWord as deleteWordRequest,
  fetchWords,
  updateWord as updateWordRequest,
} from '../../api/words'
import { normalizeApiError } from '../../errors'

export const DEFAULT_PAGE_SIZE = 10

export const useWordsStore = defineStore('words', () => {
  const items = ref([])
  const total = ref(0)
  const counts = ref(null)
  const query = ref('')
  const status = ref('all')
  const page = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  const loading = ref(false)
  const error = ref('')

  // 搜索防抖与翻页可能产生并发请求，只允许最后一次响应写入状态
  let requestSeq = 0

  const hasItems = computed(() => items.value.length > 0)
  const isFiltered = computed(() => Boolean(query.value) || status.value !== 'all')

  function toFailure(caught) {
    const normalized = normalizeApiError(caught)
    const field = normalized?.field || ''

    return {
      ok: false,
      errors: field ? { [field]: normalized.message } : {},
      message: normalized?.message || '网络出了点问题，请稍后重试。',
      code: normalized?.code || '',
    }
  }

  /** 拉取当前查询条件下的列表；quiet 用于写操作后的后台对账，不触发骨架屏 */
  async function fetchList({ quiet = false } = {}) {
    const current = (requestSeq += 1)
    if (!quiet) {
      loading.value = true
      error.value = ''
    }

    try {
      const result = await fetchWords({
        q: query.value,
        status: status.value,
        page: page.value,
        pageSize: pageSize.value,
      })

      if (current !== requestSeq) return { ok: true, stale: true }

      items.value = result.items
      total.value = result.total
      counts.value = result.counts
      page.value = result.page
      pageSize.value = result.pageSize
      loading.value = false
      return { ok: true }
    } catch (caught) {
      if (current !== requestSeq) return { ok: false, stale: true }

      loading.value = false
      if (!quiet) {
        error.value = normalizeApiError(caught)?.message || '网络出了点问题，请稍后重试。'
        items.value = []
        total.value = 0
      }
      return toFailure(caught)
    }
  }

  function setQuery(value) {
    query.value = String(value ?? '').trim()
    page.value = 1
  }

  function setStatus(value) {
    status.value = value || 'all'
    page.value = 1
  }

  async function search(value) {
    setQuery(value)
    return fetchList()
  }

  async function filterByStatus(value) {
    setStatus(value)
    return fetchList()
  }

  async function goToPage(value) {
    page.value = Math.max(1, Number(value) || 1)
    return fetchList()
  }

  /** 新增单词；成功后回到第 1 页，新词按创建时间排在最前 */
  async function addWord(payload = {}) {
    try {
      const item = await createWord({
        word: payload.word,
        meaning: payload.meaning,
        status: payload.status,
      })

      page.value = 1
      await fetchList({ quiet: true })
      return { ok: true, item }
    } catch (caught) {
      return toFailure(caught)
    }
  }

  /** 编辑单词；静默刷新处理“改状态后不再符合当前筛选”的情况 */
  async function updateWord(id, patch = {}) {
    try {
      const item = await updateWordRequest(id, patch)
      await fetchList({ quiet: true })
      return { ok: true, item }
    } catch (caught) {
      return toFailure(caught)
    }
  }

  /** 删除单词；当前页删空后自动回到上一页 */
  async function removeWord(id) {
    try {
      const removed = items.value.find((item) => item.id === id)
      await deleteWordRequest(id)

      items.value = items.value.filter((item) => item.id !== id)
      total.value = Math.max(0, total.value - 1)

      if (removed && counts.value) {
        counts.value = {
          ...counts.value,
          all: Math.max(0, counts.value.all - 1),
          [removed.status]: Math.max(0, (counts.value[removed.status] || 0) - 1),
        }
      }

      if (!items.value.length && total.value > 0 && page.value > 1) {
        page.value -= 1
      }

      await fetchList({ quiet: true })
      return { ok: true, item: removed || { id } }
    } catch (caught) {
      return toFailure(caught)
    }
  }

  function reset() {
    requestSeq += 1
    items.value = []
    total.value = 0
    counts.value = null
    query.value = ''
    status.value = 'all'
    page.value = 1
    pageSize.value = DEFAULT_PAGE_SIZE
    loading.value = false
    error.value = ''
  }

  return {
    items,
    total,
    counts,
    query,
    status,
    page,
    pageSize,
    loading,
    error,
    hasItems,
    isFiltered,
    fetchList,
    setQuery,
    setStatus,
    search,
    filterByStatus,
    goToPage,
    addWord,
    updateWord,
    removeWord,
    reset,
  }
})
