/**
 * 阅读设置状态
 * 负责难度、文章长度、题目数量的本地持久化（wr.settings.v1）。
 * 刷新后首次使用本 store 时自动读取并校验；非法数据按默认值处理，不阻塞页面。
 *
 * 用法：const settings = useSettingsStore()
 *       settings.save({ level: 'easy', targetWords: 120, questionCount: 5 })
 *       settings.payload // { level, targetWords, questionCount }
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { localStore, storageKeys } from '../../unit/storage'
import { validateSettings } from '../../unit/validators'

const DEFAULTS = Object.freeze({
  level: 'easy',
  targetWords: 100,
  questionCount: 5,
})

/**
 * 读取本地设置
 * 返回 null 表示从未保存过或数据不合法；调用方据此决定是否提示“先完成阅读设置”。
 */
function readStoredSettings() {
  const stored = localStore.get(storageKeys.settings, null)
  if (!stored || typeof stored !== 'object') return null

  const { valid } = validateSettings(stored)
  if (!valid) return null

  return {
    level: stored.level,
    targetWords: Number(stored.targetWords),
    questionCount: Number(stored.questionCount),
    updatedAt: typeof stored.updatedAt === 'string' ? stored.updatedAt : '',
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const stored = readStoredSettings()

  const level = ref(stored?.level || DEFAULTS.level)
  const targetWords = ref(stored?.targetWords || DEFAULTS.targetWords)
  const questionCount = ref(stored?.questionCount || DEFAULTS.questionCount)
  const updatedAt = ref(stored?.updatedAt || '')

  const hasSavedSettings = computed(() => Boolean(updatedAt.value))
  const payload = computed(() => ({
    level: level.value,
    targetWords: targetWords.value,
    questionCount: questionCount.value,
  }))

  function apply(next) {
    level.value = next.level
    targetWords.value = Number(next.targetWords)
    questionCount.value = Number(next.questionCount)
  }

  /**
   * 保存设置：未传的字段沿用当前值
   * 校验失败时不写本地存储，返回 { valid: false, errors } 供表单逐项展示
   */
  function save(draft = {}) {
    const candidate = { ...payload.value, ...draft }
    const { valid, errors } = validateSettings(candidate)

    if (!valid) return { valid: false, errors }

    const next = {
      level: candidate.level,
      targetWords: Number(candidate.targetWords),
      questionCount: candidate.questionCount,
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
    updatedAt,
    hasSavedSettings,
    payload,
    save,
    load,
    reset,
  }
})
