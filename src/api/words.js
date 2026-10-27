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

/** 新增单词；重复单词由后端返回 WORD_EXISTS */
export function createWord(payload) {
  if (config.useMock) return mockWords.create(payload)
  return apiPost('/words', payload)
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
