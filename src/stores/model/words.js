/**
 * 词汇状态
 * 管理词汇列表的查询条件、分页、计数与增删改，视图不直接调用 api/words。
 * 写操作成功后做一次静默刷新，保证列表、总数与 counts 与后端一致；
 * 请求失败统一归一化为 { code, message, field }，字段错误交给表单展示。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  batchWords,
  createWord,
  deleteWord as deleteWordRequest,
  extractWordImport,
  fetchWords,
  updateWord as updateWordRequest,
} from '../../api/words'
import { normalizeApiError } from '../../errors'
import { WORD_BATCH_MAX } from '../../unit/validators'

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
  // 是否已经有过一次成功的列表结果；用来区分「首次加载」与「切换筛选」：
  // 前者该出骨架屏，后者列表为空时应继续显示原来的空态，而不是先闪一帧骨架。
  const hasLoaded = ref(false)

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
      hasLoaded.value = true
      return { ok: true }
    } catch (caught) {
      if (current !== requestSeq) return { ok: false, stale: true }

      loading.value = false
      if (!quiet) {
        error.value = normalizeApiError(caught)?.message || '网络出了点问题，请稍后重试。'
        items.value = []
        total.value = 0
        // 列表已被清空，重试时按首次加载处理，重新走骨架屏
        hasLoaded.value = false
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

  /**
   * 新增单词
   *
   * 后端对重复词默认做合并，返回 `action` 说明实际发生了什么：
   * created / reactivated / updated / enriched 会改变列表，回到第 1 页静默刷新；
   * kept 表示词库原样保留，跳过刷新，避免用户当前页无意义地跳动。
   * 命中词库时透传整条快照，手填时只有 word / status / meaning 有意义。
   */
  async function addWord(payload = {}) {
    try {
      const result = await createWord({
        word: payload.word,
        status: payload.status,
        source: payload.source,
        dictionaryId: payload.dictionaryId ?? null,
        phonetic: payload.phonetic ?? null,
        senses: payload.senses ?? [],
        meaning: payload.meaning,
        includeCounts: true,
      })

      const action = result?.action || 'created'
      const duplicate = result?.duplicate === true

      if (action !== 'kept') {
        page.value = 1
        await fetchList({ quiet: true })
      } else if (result?.counts) {
        counts.value = result.counts
      }

      return { ok: true, item: result, action, duplicate }
    } catch (caught) {
      return toFailure(caught)
    }
  }

  /**
   * 编辑单词；静默刷新处理“改状态后不再符合当前筛选”的情况
   * 只允许改词形、状态与手填释义：音标 / 词性 / 义项由词库维护，接口会拒绝
   */
  async function updateWord(id, patch = {}) {
    try {
      const item = await updateWordRequest(id, {
        word: patch.word,
        status: patch.status,
        meaning: patch.meaning,
      })
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

  /** 解析导入文件：只解析、不落库，返回行 / 统计 / 警告 */
  async function extractImportFile(file) {
    try {
      const data = await extractWordImport(file)
      return { ok: true, data }
    } catch (caught) {
      return toFailure(caught)
    }
  }

  /** 批量导入预览：只返回将新增 / 更新 / 跳过多少条，不落库 */
  async function previewBatch(payload = {}) {
    try {
      const data = await batchWords({ ...payload, dryRun: true })
      return { ok: true, data }
    } catch (caught) {
      return toFailure(caught)
    }
  }

  /**
   * 把 batch 响应里的相对下标映射回文件行号
   *
   * batch 接口只认识 `words[]`，返回的 `errors[].index` 是当前批次的数组下标；
   * 文件导入多批提交时必须加回偏移量，否则第 2 批的错误会显示成「第 1 行」。
   * 如果行上还保留了解析接口给的原始行号（CSV 表头、注释行），优先用它。
   */
  function remapIndexedItems(items, chunk, offset) {
    return (items || []).map((item) => {
      const position = Number(item?.index)
      if (!Number.isInteger(position)) return { ...item }

      const sourceIndex = chunk[position]?.index
      return {
        ...item,
        index: Number.isInteger(sourceIndex) ? sourceIndex : offset + position,
      }
    })
  }

  function emptyImportResult() {
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      total: 0,
      items: [],
      skippedItems: [],
      errors: [],
      chunkErrors: [],
    }
  }

  /**
   * 文件行分批导入
   *
   * 解析接口最多返回 500 条，而 batch 单次只接受 200 条，所以按 200 条串行提交。
   * 串行而不是并发：后端对 batch 有频率限制，并发只会更快撞 429。
   * 某一批请求失败时继续跑后面的批次，失败条目计入 failed，并单独记录 chunkErrors。
   */
  async function importRows(rows, status, onProgress) {
    const chunks = []
    for (let start = 0; start < rows.length; start += WORD_BATCH_MAX) {
      chunks.push(rows.slice(start, start + WORD_BATCH_MAX))
    }

    const combined = emptyImportResult()
    let succeeded = 0
    let lastFailure = null

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index]
      const offset = index * WORD_BATCH_MAX
      const words = chunk.map((row) => ({
        word: String(row?.word ?? '').trim(),
        meaning: String(row?.meaning ?? '').trim(),
      }))

      try {
        const data = await batchWords({ words, status, dryRun: false })
        succeeded += 1
        combined.created += data?.created || 0
        combined.updated += data?.updated || 0
        combined.skipped += data?.skipped || 0
        combined.failed += data?.failed || 0
        combined.total += data?.total ?? chunk.length
        combined.items.push(...(data?.items || []))
        combined.skippedItems.push(...remapIndexedItems(data?.skippedItems, chunk, offset))
        combined.errors.push(...remapIndexedItems(data?.errors, chunk, offset))
      } catch (caught) {
        lastFailure = toFailure(caught)
        // 这一批整批没发出去，行数也要算进「未导入」，否则 Toast 会少报
        combined.failed += chunk.length
        combined.total += chunk.length
        combined.chunkErrors.push({
          start: offset,
          end: offset + chunk.length - 1,
          message: lastFailure.message,
          code: lastFailure.code || '',
        })
      }

      onProgress?.(index + 1, chunks.length)
    }

    if (combined.created + combined.updated > 0) {
      page.value = 1
      await fetchList({ quiet: true })
    }

    // 一批都没成功时按失败返回；否则即使有单批失败，也把已成功的部分交给用户
    if (succeeded === 0) return { ...lastFailure, ok: false, data: combined }
    return { ok: true, data: combined }
  }

  /**
   * 正式批量导入
   *
   * 单条失败不会让整个请求失败（后端仍返回 200 + errors），
   * 这里只在确实有新增 / 更新时刷新列表，避免「全部跳过」也把页码打回第 1 页。
   * `payload.rows` 是文件导入的行数组（≤500），会按 200 条分批；粘贴文本仍走原路径。
   */
  async function importBatch(payload = {}) {
    if (Array.isArray(payload.rows)) {
      if (!payload.rows.length) {
        return { ok: false, errors: {}, message: '没有可导入的内容。', code: 'INVALID_REQUEST' }
      }
      return importRows(payload.rows, payload.status, payload.onProgress)
    }

    try {
      const data = await batchWords({ ...payload, dryRun: false })

      if ((data?.created || 0) + (data?.updated || 0) > 0) {
        page.value = 1
        await fetchList({ quiet: true })
      }

      return { ok: true, data }
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
    hasLoaded.value = false
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
    hasLoaded,
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
    extractImportFile,
    previewBatch,
    importBatch,
    reset,
  }
})
