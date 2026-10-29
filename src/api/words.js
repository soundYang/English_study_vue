/**
 * 词汇 API 门面
 * 视图与 store 只依赖本文件；VITE_USE_MOCK 决定走本地 mock 还是真实后端。
 * 后端字段如有差异，只在本层做映射，不污染视图。
 */
import { config } from '../config'
import { mockWords } from '../mock/adapter'
import { apiDelete, apiGet, apiPatch, apiPost } from '../unit/request'

/** 获取词汇列表（分页、关键词搜索、学习状态筛选） */
export function fetchWords(params = {}) {
  if (config.useMock) return mockWords.list(params)
  return apiGet('/words', params)
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

/** 局部更新单词：单词、释义或学习状态 */
export function updateWord(id, patch) {
  if (config.useMock) return mockWords.update(id, patch)
  return apiPatch(`/words/${id}`, patch)
}

/** 删除单词；阅读中的词汇快照不受影响 */
export function deleteWord(id) {
  if (config.useMock) return mockWords.remove(id)
  return apiDelete(`/words/${id}`)
}
