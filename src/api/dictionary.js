/**
 * 词库 API 门面
 * 视图与组件只依赖本文件；VITE_USE_MOCK 决定走本地 mock 词表还是真实后端。
 * 返回结构固定为设计文档 5.1 节的词条形态，换供应商也只在本层之后归一化。
 */
import { config } from '../config'
import { mockDictionary } from '../mock/dictionary'
import { apiGet } from '../unit/request'

/**
 * 搜索词条（前缀优先、包含次之）
 * @param {string} q 查询词，长度不足 2 时后端返回空数组
 * @param {{ signal?: AbortSignal }} options 可中断，切换输入时中止上一次请求
 * @returns {Promise<{ query: string, items: Array }>}
 */
export async function searchDictionary(q, { signal } = {}) {
  if (config.useMock) {
    const items = await mockDictionary.search(q, { signal })
    return { query: q, items }
  }
  return apiGet('/dictionary/search', { q, limit: 8 }, { signal })
}
