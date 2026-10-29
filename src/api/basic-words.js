/**
 * 基础词表 API
 * 列表、公开列表、三态标记三项；本页不做 mock，直接请求真实后端（md/16 §4.2、md/52）。
 * 650 条词表与个人状态只有后端有，本地造一份只会和维护第二份真相。
 */
import { apiGet, apiPatch } from '../unit/request'

/** 获取基础词表（分组 / 状态 / 关键词 / 分页） */
export function fetchBasicWords(params = {}) {
  return apiGet('/basic-words', params)
}

/**
 * 游客浏览基础词表：公开只读，后端不返回个人状态
 * 与登录接口同参数同结构，personalStatus / removed 恒为公共值（md/50）
 */
export function fetchPublicBasicWords(params = {}) {
  return apiGet('/public/basic-words', params)
}

/**
 * 设置个人标记（md/52 §2.2）
 * state: known 认识 / unknown 不认识 / none 取消标记
 * PATCH 是设状态且幂等，重复提交同一状态返回 200 空操作
 */
export function setBasicWordMark(word, state) {
  return apiPatch(`/basic-words/${encodeURIComponent(word)}`, { state })
}
