/**
 * 词汇 API 门面
 * 视图与 store 只依赖本文件；VITE_USE_MOCK 决定走本地 mock 还是真实后端。
 * 后端字段如有差异，只在本层做映射，不污染视图。
 */
import { config } from '../config'
import { mockWords } from '../mock/adapter'
import { pathSegment } from '../unit/path'
import { apiDelete, apiGet, apiPatch, apiPost } from '../unit/request'

/**
 * 获取词汇列表（分页、关键词搜索、学习状态筛选）
 *
 * @param {object} params 查询参数
 * @param {{ signal?: AbortSignal }} [options] 可中断；结果页按词查询释义时用
 */
export function fetchWords(params = {}, { signal } = {}) {
  if (config.useMock) return mockWords.list(params)
  return apiGet('/words', params, { signal })
}

/**
 * 新增单词
 *
 * 重复词默认走合并（`onDuplicate: auto`，返回 action / duplicate），
 * 只有显式传 `onDuplicate: 'error'` 才会得到 409 WORD_EXISTS。
 */
export function createWord(payload) {
  if (config.useMock) return mockWords.create(payload)
  return apiPost('/words', payload)
}

/** 预检：只判断是否已存在、会走哪个合并动作，不落库 */
export function checkWords(words, options = {}) {
  if (config.useMock) return mockWords.check({ words }, options)
  return apiPost('/words/check', { words }, options)
}

/** 批量导入：`dryRun` 只取预览，正式执行返回逐条结果 */
export function batchWords(payload = {}) {
  if (config.useMock) return mockWords.batch(payload)
  return apiPost('/words/batch', payload)
}

/**
 * 解析导入文件（Word / Excel / CSV / 文本 / 图片）
 *
 * 只解析、不写库；字段名固定为 `file`，一次一个文件，最大 5MB。
 * `mode: 'ai'` 时多传一个 multipart 文本字段 `mode=ai`，由后端用账号自备的
 * API Key 整理释义（md/49）；`local` 不传该字段，保持旧行为。
 * 共享 axios 实例默认 `Content-Type: application/json`，而 axios 看到
 * FormData + JSON 头会把 FormData 转成 `"{}"`；这里必须把该头清掉，
 * 让浏览器自己补 multipart boundary。
 * AI 模式后端最坏 45 秒，必须单独用 60 秒超时，否则前端先报网络错误、
 * 用户重试会重复消耗自己的额度（md/49 §13）。
 */
export function extractWordImport(file, { mode = 'local' } = {}) {
  const useAi = mode === 'ai'
  if (config.useMock) return mockWords.extractImport(file, { mode: useAi ? 'ai' : 'local' })

  const form = new FormData()
  form.append('file', file)
  if (useAi) form.append('mode', 'ai')

  return apiPost('/words/import/extract', form, {
    headers: { 'Content-Type': undefined },
    timeout: useAi ? config.importAiTimeout : config.importTimeout,
  })
}

/** 局部更新单词：单词、释义或学习状态 */
export function updateWord(id, patch) {
  if (config.useMock) return mockWords.update(id, patch)
  return apiPatch(`/words/${pathSegment(id)}`, patch)
}

/** 删除单词；阅读中的词汇快照不受影响 */
export function deleteWord(id) {
  if (config.useMock) return mockWords.remove(id)
  return apiDelete(`/words/${pathSegment(id)}`)
}

/**
 * 批量修改学习状态（md/22 #115）
 *
 * `ids` 1–200 个，重复 id 由后端去重；`target` 五选一：
 * new / learning / mastered / removed / restore。
 * `dryRun: true` 只返回 `plan[]`，不写库。
 */
export function batchUpdateWordStatus({ ids, target, dryRun = false } = {}) {
  if (config.useMock) return mockWords.batchUpdateStatus({ ids, target, dryRun })
  return apiPost('/words/status/batch', { ids, target, dryRun })
}

/**
 * 今日复习任务（md/56 §8.1）
 *
 * 返回今日到期词（最多 50 个）、积压总量与新词配额进度。
 * 后端在响应前会先跑每日结算，所以打开页面拿到的就是今天的队列。
 */
export function fetchDailyPlan() {
  if (config.useMock) return mockWords.dailyPlan()
  return apiGet('/words/daily-plan')
}

/**
 * 单词自评（md/56 §7）
 *
 * `result` 只有 pass / lapse 两个值，没有默认值：自评会推进复习轮次，
 * 猜错比明确报错代价大。返回更新后的 WordDto。
 */
export function reviewWord(id, result) {
  if (config.useMock) return mockWords.review(id, result)
  return apiPost(`/words/${pathSegment(id)}/review`, { result })
}

/**
 * 批量自评（md/56 §8.1）
 *
 * `items` 为 `[{ id, result }]`，一次 1–200 条。单项失败进 `skipped`，
 * 不会让整批失败；用 id 而不是词形（词形可以被用户改掉）。
 */
export function reviewWords(items) {
  if (config.useMock) return mockWords.reviewBatch({ items })
  return apiPost('/words/review/batch', { items })
}

/** 学习统计（md/56 §10 P3）：连续天数、今日/累计、掌握情况、待复习数与 30 天热力图 */
export function fetchStudyStats() {
  if (config.useMock) return mockWords.stats()
  return apiGet('/words/stats')
}
