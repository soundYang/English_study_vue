/**
 * 基础词表状态
 * 维护分组 / 状态 / 搜索 / 分页与「标记不认识 / 恢复」；
 * 视图不直接调用 api/basic-words，写操作后的列表同步规则集中在 applyMutation。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchBasicWords, removeBasicWord, restoreBasicWord } from '../../api/basic-words'
import { normalizeApiError } from '../../errors'
import { BASIC_PAGE_SIZES } from '../../unit/basic-words'

export const DEFAULT_PAGE_SIZE = 100

const FALLBACK_MESSAGE = '网络出了点问题，请稍后重试。'

export const useBasicWordsStore = defineStore('basic-words', () => {
  const items = ref([])
  const total = ref(0)
  const counts = ref(null)
  const query = ref('')
  const group = ref('basic')
  const status = ref('all')
  const page = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  const loading = ref(false)
  const error = ref('')
  // 正在标记 / 恢复的词：只禁用那一张卡，其它词互不影响
  const pendingWord = ref('')

  // 搜索与翻页会并发，只允许最后一次响应写入状态
  let requestSeq = 0

  const hasItems = computed(() => items.value.length > 0)
  const isFiltered = computed(() => Boolean(query.value) || status.value !== 'all')

  function toFailure(caught) {
    const normalized = normalizeApiError(caught)

    return {
      ok: false,
      message: normalized?.message || FALLBACK_MESSAGE,
      code: normalized?.code || '',
      details: normalized?.details || {},
    }
  }

  /** 拉取当前条件下的列表；quiet 用于写操作后的对账，不触发骨架屏 */
  async function fetchList({ quiet = false } = {}) {
    const current = (requestSeq += 1)
    if (!quiet) {
      loading.value = true
      error.value = ''
    }

    try {
      const result = await fetchBasicWords({
        q: query.value,
        group: group.value,
        status: status.value,
        page: page.value,
        pageSize: pageSize.value,
      })

      if (current !== requestSeq) return { ok: true, stale: true }

      items.value = result.items
      total.value = result.total
      counts.value = result.counts
      // 页码越界时后端会收敛并回传真实页码，以前端为准会多一次空列表
      page.value = result.page
      pageSize.value = result.pageSize
      loading.value = false
      return { ok: true }
    } catch (caught) {
      if (current !== requestSeq) return { ok: false, stale: true }

      loading.value = false
      if (!quiet) {
        error.value = normalizeApiError(caught)?.message || FALLBACK_MESSAGE
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

  async function search(value) {
    setQuery(value)
    return fetchList()
  }

  async function setGroup(value) {
    group.value = value || 'basic'
    page.value = 1
    return fetchList()
  }

  async function setStatus(value) {
    status.value = value || 'all'
    page.value = 1
    return fetchList()
  }

  async function setPageSize(value) {
    const size = Number(value)
    if (!BASIC_PAGE_SIZES.includes(size)) return { ok: false, message: '不支持的每页条数' }

    pageSize.value = size
    page.value = 1
    return fetchList()
  }

  async function goToPage(value) {
    page.value = Math.max(1, Number(value) || 1)
    return fetchList()
  }

  /**
   * 写操作落库后同步列表。
   * 无状态筛选：就地替换那一行、数字卡用返回值覆盖，再静默对账一次；
   * 有状态筛选：这一行可能已经不属于当前结果（未标记里标成不认识、不认识里点恢复），
   * 必须重拉，否则筛选列表里会留一条不该出现的词（md/16 §4.3）。
   */
  function applyMutation(result, word) {
    if (result?.counts) counts.value = result.counts

    const item = result?.item || { word }
    if (status.value === 'all') {
      items.value = items.value.map((row) => (row.word === item.word ? { ...row, ...item } : row))
    }

    return fetchList({ quiet: true })
  }

  /** 标记不认识；词已收录进个人词库时后端给 409，文案里自带出口 */
  async function markRemoved(word) {
    pendingWord.value = word
    try {
      const result = await removeBasicWord(word)
      await applyMutation(result, word)
      return { ok: true, item: result.item, counts: result.counts }
    } catch (caught) {
      return toFailure(caught)
    } finally {
      pendingWord.value = ''
    }
  }

  /** 恢复：只对 source = basic-removed 的记录有效，用户自建的词后端会拒绝 */
  async function restore(word) {
    pendingWord.value = word
    try {
      const result = await restoreBasicWord(word)
      await applyMutation(result, word)
      return { ok: true, item: result.item, counts: result.counts }
    } catch (caught) {
      return toFailure(caught)
    } finally {
      pendingWord.value = ''
    }
  }

  function reset() {
    requestSeq += 1
    items.value = []
    total.value = 0
    counts.value = null
    query.value = ''
    group.value = 'basic'
    status.value = 'all'
    page.value = 1
    pageSize.value = DEFAULT_PAGE_SIZE
    loading.value = false
    error.value = ''
    pendingWord.value = ''
  }

  return {
    items,
    total,
    counts,
    query,
    group,
    status,
    page,
    pageSize,
    loading,
    error,
    pendingWord,
    hasItems,
    isFiltered,
    fetchList,
    search,
    setGroup,
    setStatus,
    setPageSize,
    goToPage,
    markRemoved,
    restore,
    reset,
  }
})
