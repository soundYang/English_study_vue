/**
 * 基础词表 API
 * 列表、标记不认识、恢复三项；本页不做 mock，直接请求真实后端（md/16 §4.2）。
 * 650 条词表与个人状态只有后端有，本地造一份只会和维护第二份真相。
 */
import { apiDelete, apiGet, apiPut } from '../unit/request'

/** 获取基础词表（分组 / 状态 / 关键词 / 分页） */
export function fetchBasicWords(params = {}) {
  return apiGet('/basic-words', params)
}

/** 标记不认识：从个人基础词里移除这个词 */
export function removeBasicWord(word) {
  return apiDelete(`/basic-words/${encodeURIComponent(word)}`)
}

/** 恢复：撤销本页的「不认识」，词回到未标记 */
export function restoreBasicWord(word) {
  return apiPut(`/basic-words/${encodeURIComponent(word)}`)
}
