/**
 * 可选词库 API 门面（md/22 §11.2、md/55 §6.1）
 *
 * 五个接口对应「词库总览 → 目录 → 导入 → 批量改状态 → 重置」整条链路；
 * 视图与 store 只依赖本文件，VITE_USE_MOCK 决定走本地 mock 还是真实后端。
 */
import { config } from '../config'
import { mockWordBanks } from '../mock/adapter'
import { pathSegment } from '../unit/path'
import { apiGet, apiPost } from '../unit/request'

/** 获取两个词库的概要（总量 / 已导入 / 个人词库剩余名额） */
export function fetchWordBanks({ signal } = {}) {
  if (config.useMock) return mockWordBanks.list()
  return apiGet('/word-banks', {}, { signal })
}

/**
 * 获取词库目录（分页 / 搜索 / 已导入筛选）
 *
 * `filter` 看的是导入记录：`imported` = 从本词库导入过，
 * 用户原本就在个人词库里的词不算（`inLibrary=true, imported=false`）。
 */
export function fetchWordBankWords(bank, { page, pageSize, q, filter } = {}, { signal } = {}) {
  if (config.useMock) return mockWordBanks.words(bank, { page, pageSize, q, filter })
  return apiGet(`/word-banks/${pathSegment(bank)}/words`, { page, pageSize, q, filter }, { signal })
}

/**
 * 导入所选词或整库分批导入
 *
 * `words` 与 `all` 二选一；整库导入按 `cursor / limit` 循环到 `done=true`，
 * 名额用完时返回 `limitReached=true`，`nextCursor` 停在没处理的词上。
 */
export function addWordsToBank(bank, payload = {}) {
  if (config.useMock) return mockWordBanks.add(bank, payload)
  return apiPost(`/word-banks/${pathSegment(bank)}/add`, payload)
}

/** 只改「从本词库导入」的词的状态；同一批里用户原有的词进 `notInBank` */
export function batchUpdateBankStatus(bank, { words, target, dryRun = false } = {}) {
  if (config.useMock) return mockWordBanks.batchStatus(bank, { words, target, dryRun })
  return apiPost(`/word-banks/${pathSegment(bank)}/status/batch`, { words, target, dryRun })
}

/** 重置本词库：只删有本库导入记录的词与记录，用户原有的词不受影响 */
export function resetWordBank(bank, { confirm = true } = {}) {
  if (config.useMock) return mockWordBanks.reset(bank, { confirm })
  return apiPost(`/word-banks/${pathSegment(bank)}/reset`, { confirm })
}
