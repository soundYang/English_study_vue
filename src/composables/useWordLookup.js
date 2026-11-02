/**
 * 单词释义查找（结果页「本文用到的词」点击）
 *
 * 用途：按词形取「词性 + 中文释义」，供 WordDetailPopover 展示。
 *       优先个人词库——手填词也有释义；个人词库没有或释义为空时退回词典。
 * 用法：const { lookup, cancel } = useWordLookup()
 *       const detail = await lookup(word)
 *
 * 口径：
 *   - 只认完全相等的词形，不拿前缀 / 包含结果顶替（art ≠ article）
 *   - 结果按归一化词形缓存，空结果也缓存；失败不缓存，允许再次点击重试
 *   - 同一时间只保留最后一个请求；序号兜底 mock 不处理 AbortSignal 的情况
 */
import { onBeforeUnmount } from 'vue'
import { searchDictionary } from '../api/dictionary'
import { fetchWords } from '../api/words'
import { dictionaryWordDetail, usedWordDetail } from '../unit/word-detail'

const EMPTY_MESSAGE = '没有查到这个词的释义，它可能已从词库删除，或不在词库中。'
const ERROR_MESSAGE = '释义加载失败，再点一次可以重试。'
const WORD_PAGE_SIZE = 100

function normalize(word) {
  return String(word ?? '')
    .trim()
    .toLowerCase()
}

function findExact(items, key, field) {
  return (items || []).find((item) => normalize(item?.[field]) === key) || null
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.name === 'CanceledError'
}

function emptyDetail(word, state = 'empty', message = EMPTY_MESSAGE) {
  return { word, phonetic: null, senses: [], facts: [], state, message }
}

export function useWordLookup() {
  const cache = new Map()
  let controller = null
  let seq = 0

  /**
   * 查询一个词的展示数据
   * @param {string} rawWord 触发查询的词
   * @returns {Promise<object|null>} 被中止 / 被更新请求取代时返回 null
   */
  async function lookup(rawWord) {
    const word = String(rawWord ?? '').trim()
    const key = normalize(word)
    if (!key) return emptyDetail(word)

    if (cache.has(key)) return cache.get(key)

    controller?.abort()
    controller = new AbortController()
    const current = (seq += 1)
    const { signal } = controller

    try {
      const list = await fetchWords(
        { q: word, pageSize: WORD_PAGE_SIZE, includeRemoved: true },
        { signal },
      )
      if (current !== seq) return null

      const mine = findExact(list?.items, key, 'word')
      if (mine?.senses?.length) {
        const detail = { ...usedWordDetail(mine), state: 'ready', message: '' }
        cache.set(key, detail)
        return detail
      }

      const found = await searchDictionary(word, { signal })
      if (current !== seq) return null

      const entry = findExact(found?.items, key, 'headword')
      if (entry?.senses?.length) {
        const detail = { ...dictionaryWordDetail(entry), state: 'ready', message: '' }
        cache.set(key, detail)
        return detail
      }

      const empty = emptyDetail(word)
      cache.set(key, empty)
      return empty
    } catch (error) {
      if (isAbortError(error) || current !== seq) return null

      return emptyDetail(word, 'error', ERROR_MESSAGE)
    }
  }

  /** 组件卸载 / 主动放弃时中止进行中的请求，并让旧响应失效 */
  function cancel() {
    seq += 1
    controller?.abort()
    controller = null
  }

  onBeforeUnmount(cancel)

  return { lookup, cancel }
}
