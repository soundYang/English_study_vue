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
  fetchDailyPlan,
  fetchWords,
  reviewWord as reviewWordRequest,
  reviewWords as reviewWordsRequest,
  updateWord as updateWordRequest,
} from '../../api/words'
import { normalizeApiError } from '../../errors'
import { WORD_BATCH_MAX } from '../../unit/validators'

export const DEFAULT_PAGE_SIZE = 10

export const useWordsStore = defineStore('words', () => {
  const items = ref([])
  const total = ref(0)
  // 标签页的数字来自 studyCounts（按 studyState 分档），不是 counts（按 status 分档）：
  // 后者把「今天加的 / 结算前的老词 / 墓碑词」全算在 new 一档里，与列表条数对不上（md/22 第 96 行）
  const studyCounts = ref(null)
  const query = ref('')
  // 筛选维度用后端的 `study`（对应 studyState），不是 `status`：墓碑词混不进前三档
  const study = ref('all')
  const page = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  const loading = ref(false)
  const error = ref('')
  // 今日复习任务（md/56 §8.1）：null = 没加载或加载失败，入口条据此隐藏
  const dailyPlan = ref(null)
  const dailyPlanLoading = ref(false)
  // 是否已经有过一次成功的列表结果；用来区分「首次加载」与「切换筛选」：
  // 前者该出骨架屏，后者列表为空时应继续显示原来的空态，而不是先闪一帧骨架。
  const hasLoaded = ref(false)

  // 搜索防抖与翻页可能产生并发请求，只允许最后一次响应写入状态
  let requestSeq = 0

  const hasItems = computed(() => items.value.length > 0)
  const isFiltered = computed(() => Boolean(query.value) || study.value !== 'all')

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
        study: study.value,
        page: page.value,
        pageSize: pageSize.value,
      })

      if (current !== requestSeq) return { ok: true, stale: true }

      items.value = result.items
      total.value = result.total
      studyCounts.value = result.studyCounts
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

  function setStudy(value) {
    study.value = value || 'all'
    page.value = 1
  }

  async function search(value) {
    setQuery(value)
    return fetchList()
  }

  async function filterByStudy(value) {
    setStudy(value)
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
      } else if (result?.studyCounts) {
        studyCounts.value = result.studyCounts
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

      // 本地先扣一次，避免删除后标签数字要等静默刷新才变。
      // `all` 是前三档之和、不含「不认识」，所以删墓碑词时只动 removed 那一档
      if (removed && studyCounts.value) {
        const state = removed.studyState
        const next = { ...studyCounts.value }
        if (state !== 'removed') next.all = Math.max(0, (next.all || 0) - 1)
        if (state) next[state] = Math.max(0, (next[state] || 0) - 1)
        studyCounts.value = next
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

  /** 解析导入文件：只解析、不落库，返回行 / 统计 / 警告；`mode: 'ai'` 交给后端用自己的 Key 整理 */
  async function extractImportFile(file, options = {}) {
    try {
      const data = await extractWordImport(file, options)
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

  /**
   * 拉取今日复习任务
   *
   * 入口条不是关键路径：失败一律静默（保留上一次结果、不弹错），
   * 词汇列表与复习页各自按自己的加载态兜底。
   */
  async function loadDailyPlan({ quiet = false } = {}) {
    if (!quiet) dailyPlanLoading.value = true

    try {
      const plan = await fetchDailyPlan()
      dailyPlan.value = plan
      return { ok: true, data: plan }
    } catch (caught) {
      return toFailure(caught)
    } finally {
      if (!quiet) dailyPlanLoading.value = false
    }
  }

  /**
   * 本地扣减今日进度（仅用于点完按钮的即时反馈，刷新后以后端为准）
   *
   * `updated` 是真正复习成功的条数：`remaining` / `today` 各减这么多、
   * `doneToday` 加上去，再把已处理的 id 从当前清单里摘掉。
   * skipped 的词只摘清单、不扣数（它们本来就不该占着队列）。
   */
  function consumePlanWords(ids, updated = ids.length) {
    const plan = dailyPlan.value
    if (!plan?.review) return

    const idSet = new Set(ids)
    const remaining = Math.max(0, (plan.review.remaining || 0) - updated)

    dailyPlan.value = {
      ...plan,
      review: {
        ...plan.review,
        remaining,
        // 今天建议数会随积压一起缩，但不超过原值（积压 > 50 时保持 50）
        today: Math.max(0, Math.min(plan.review.today || 0, remaining)),
        doneToday: (plan.review.doneToday || 0) + updated,
        words: (plan.review.words || []).filter((item) => !idSet.has(item.id)),
      },
    }
  }

  /** 单条自评（md/56 §7）：result 只有 pass / lapse，由调用方保证 */
  async function reviewWord(id, result) {
    try {
      const item = await reviewWordRequest(id, result)
      consumePlanWords([id])
      return { ok: true, item }
    } catch (caught) {
      return toFailure(caught)
    }
  }

  /**
   * 批量自评（md/56 §8.1）
   *
   * 单项失败只进 skipped，不拖垮整批；skipped 的词从本地清单摘掉，
   * 然后静默重拉一次与后端对账（计数以服务端为准）。
   */
  async function reviewBatch(items) {
    try {
      const data = await reviewWordsRequest(items)
      const writtenIds = (data?.words || []).map((item) => item.id)
      const skippedIds = (data?.skipped || []).map((item) => item.id)

      consumePlanWords(writtenIds, data?.updated ?? writtenIds.length)

      if (skippedIds.length && dailyPlan.value?.review) {
        const skipped = new Set(skippedIds)
        const plan = dailyPlan.value
        dailyPlan.value = {
          ...plan,
          review: {
            ...plan.review,
            words: (plan.review.words || []).filter((item) => !skipped.has(item.id)),
          },
        }
        // skipped 不扣 remaining，本地数字可能略偏大：交给后端重新给一份
        await loadDailyPlan({ quiet: true })
      }

      return { ok: true, ...data }
    } catch (caught) {
      return toFailure(caught)
    }
  }

  function reset() {
    requestSeq += 1
    items.value = []
    dailyPlan.value = null
    total.value = 0
    studyCounts.value = null
    query.value = ''
    study.value = 'all'
    page.value = 1
    pageSize.value = DEFAULT_PAGE_SIZE
    loading.value = false
    error.value = ''
    hasLoaded.value = false
  }

  return {
    items,
    total,
    studyCounts,
    query,
    study,
    page,
    pageSize,
    loading,
    error,
    dailyPlan,
    dailyPlanLoading,
    hasLoaded,
    hasItems,
    isFiltered,
    fetchList,
    loadDailyPlan,
    reviewWord,
    reviewBatch,
    setQuery,
    setStudy,
    search,
    filterByStudy,
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
