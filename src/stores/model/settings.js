/**
 * 阅读设置状态
 * 负责难度、文章长度、题目数量、词源、生词容忍的本地持久化（wr.settings.v1）。
 * 刷新后首次使用本 store 时自动读取并校验；非法数据按默认值处理，不阻塞页面。
 *
 * 用法：const settings = useSettingsStore()
 *       settings.save({ level: 'easy', targetWords: 120, questionCount: 5 })
 *       settings.payload // { level, targetWords, questionCount, vocabScope, allowNewWords? }
 *
 * allowNewWords 是三态（后端 md/42）：null = 自动，true / false = 用户显式选择。
 * 自动时 payload 里干脆不出现这个键，让后端按「最终模式开、其余关」判定。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { localStore, storageKeys } from '../../unit/storage'
import {
  normalizeAllowNewWords,
  normalizeVocabScope,
  validateSettings,
} from '../../unit/validators'

const DEFAULTS = Object.freeze({
  level: 'easy',
  targetWords: 100,
  questionCount: 5,
  vocabScope: ['all'],
  allowNewWords: null,
})

/**
 * 读取本地设置
 * 返回 null 表示从未保存过或数据不合法；调用方据此决定是否提示“先完成阅读设置”。
 */
function readStoredSettings() {
  const stored = localStore.get(storageKeys.settings, null)
  if (!stored || typeof stored !== 'object') return null

  // 老数据没有 vocabScope：缺省全量；存过脏值也退回全量，不连累难度和篇幅一起作废
  const vocabScope = normalizeVocabScope(stored.vocabScope)
  const { valid } = validateSettings({ ...stored, vocabScope })
  if (!valid) return null

  return {
    level: stored.level,
    targetWords: Number(stored.targetWords),
    questionCount: Number(stored.questionCount),
    vocabScope,
    // 老数据没有这个字段：读成「自动」，不能当成显式关闭
    allowNewWords: normalizeAllowNewWords(stored.allowNewWords),
    updatedAt: typeof stored.updatedAt === 'string' ? stored.updatedAt : '',
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const stored = readStoredSettings()

  const level = ref(stored?.level || DEFAULTS.level)
  const targetWords = ref(stored?.targetWords || DEFAULTS.targetWords)
  const questionCount = ref(stored?.questionCount || DEFAULTS.questionCount)
  const vocabScope = ref([...(stored?.vocabScope || DEFAULTS.vocabScope)])
  const allowNewWords = ref(stored?.allowNewWords ?? DEFAULTS.allowNewWords)
  const updatedAt = ref(stored?.updatedAt || '')

  const hasSavedSettings = computed(() => Boolean(updatedAt.value))
  const payload = computed(() => {
    const next = {
      level: level.value,
      targetWords: targetWords.value,
      questionCount: questionCount.value,
      // 复制一份：下游（覆盖层重试、生成请求）拿到的是快照，不会跟 store 里的数组共享引用
      vocabScope: [...vocabScope.value],
    }

    // 自动时不带这个键：后端把「没传」解释成「最终模式开、其余关」，
    // 显式传 null 反而不在契约里（md/42 §3.2）
    if (allowNewWords.value !== null) next.allowNewWords = allowNewWords.value

    return next
  })

  function apply(next) {
    level.value = next.level
    targetWords.value = Number(next.targetWords)
    questionCount.value = Number(next.questionCount)
    vocabScope.value = normalizeVocabScope(next.vocabScope)
    // easy 没有开关，切回 easy 时遗留的显式值一律回到自动
    allowNewWords.value = next.level === 'easy' ? null : normalizeAllowNewWords(next.allowNewWords)
  }

  /**
   * 保存设置：未传的字段沿用当前值
   * 校验失败时不写本地存储，返回 { valid: false, errors } 供表单逐项展示
   */
  function save(draft = {}) {
    const merged = { ...payload.value, ...draft }
    // 切到 easy 后遗留的显式开关要清掉：后端对 easy + true 直接 400（md/41 §3.1），
    // 这里先归一再校验，别让脏组合进本地存储
    const candidate = {
      ...merged,
      allowNewWords: merged.level === 'easy' ? null : normalizeAllowNewWords(merged.allowNewWords),
    }
    const { valid, errors } = validateSettings(candidate)

    if (!valid) return { valid: false, errors }

    const next = {
      level: candidate.level,
      targetWords: Number(candidate.targetWords),
      questionCount: candidate.questionCount,
      vocabScope: normalizeVocabScope(candidate.vocabScope),
      allowNewWords: candidate.allowNewWords,
      updatedAt: new Date().toISOString(),
    }

    localStore.set(storageKeys.settings, next)
    apply(next)
    updatedAt.value = next.updatedAt

    return { valid: true, errors: {} }
  }

  /** 显式重新读取本地设置；返回是否读取成功 */
  function load() {
    const next = readStoredSettings()
    if (!next) return false

    apply(next)
    updatedAt.value = next.updatedAt
    return true
  }

  /** 清除本地设置并回到默认值 */
  function reset() {
    localStore.remove(storageKeys.settings)
    apply(DEFAULTS)
    updatedAt.value = ''
  }

  return {
    level,
    targetWords,
    questionCount,
    vocabScope,
    allowNewWords,
    updatedAt,
    hasSavedSettings,
    payload,
    save,
    load,
    reset,
  }
})
