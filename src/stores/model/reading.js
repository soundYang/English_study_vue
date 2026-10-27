/**
 * 当前练习状态
 * F4 先承载“生成中 / 生成失败 / 已生成”三种状态，供全局生成覆盖层与答题页共享。
 * 请求生命周期（AbortController、最短展示时长、错误归一化）集中在这里，
 * 视图只负责触发与导航，不直接调用 API。
 *
 * 状态：idle / generating / answering / error
 * 用法：const reading = useReadingStore()
 *       await reading.generate({ level, targetWords, questionCount }, { availableWords })
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { generateReading } from '../../api/readings'
import { normalizeApiError } from '../../errors'

const DEFAULT_MIN_VISIBLE = 800
const EMPTY_SUMMARY = { level: '', targetWords: 0, questionCount: 0, availableWords: null }

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.name === 'CanceledError'
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForMinVisible(startedAt, minVisible) {
  const remaining = minVisible - (Date.now() - startedAt)
  if (remaining > 0) await wait(remaining)
}

export const useReadingStore = defineStore('reading', () => {
  const reading = ref(null)
  const phase = ref('idle')
  const error = ref(null)
  const summary = ref({ ...EMPTY_SUMMARY })

  // 每次生成分配递增 id，取消或重新生成后旧请求的回调不能再改写状态
  let activeId = 0
  let controller = null

  const isGenerating = computed(() => phase.value === 'generating')
  const hasGenerationError = computed(() => phase.value === 'error' && Boolean(error.value))

  /** 写入已生成的阅读（安全 DTO），供答题页读取 */
  function setReading(next) {
    reading.value = next
    if (next) phase.value = 'answering'
  }

  /**
   * 生成阅读材料
   * 返回安全 DTO 或 null（取消 / 失败），失败原因写入 error。
   * options.minDuration 默认 800ms，测试可传 0 关闭最短展示。
   */
  async function generate(payload, options = {}) {
    if (phase.value === 'generating') return null

    const current = (activeId += 1)
    const minVisible = Number.isFinite(options.minDuration)
      ? Math.max(0, options.minDuration)
      : DEFAULT_MIN_VISIBLE
    const startedAt = Date.now()

    controller = new AbortController()
    phase.value = 'generating'
    error.value = null
    summary.value = {
      level: payload.level,
      targetWords: payload.targetWords,
      questionCount: payload.questionCount,
      availableWords: options.availableWords ?? null,
    }

    try {
      const generated = await generateReading(payload, { signal: controller.signal })
      await waitForMinVisible(startedAt, minVisible)

      if (current !== activeId) return null

      reading.value = generated
      phase.value = 'answering'
      return generated
    } catch (caught) {
      if (current !== activeId) return null
      if (isAbortError(caught)) {
        phase.value = 'idle'
        return null
      }

      await waitForMinVisible(startedAt, minVisible)
      if (current !== activeId) return null

      const normalized = normalizeApiError(caught)
      error.value = {
        code: normalized?.code || 'GENERATION_FAILED',
        message: normalized?.message || '这次生成没有成功，请稍后重试。',
      }
      phase.value = 'error'
      return null
    } finally {
      if (current === activeId) controller = null
    }
  }

  /** 取消生成：立即中止请求并把状态退回 idle */
  function cancelGeneration() {
    activeId += 1
    controller?.abort()
    controller = null
    if (phase.value === 'generating') phase.value = 'idle'
  }

  /** 关闭生成失败覆盖层，保留设置页 */
  function dismissGeneration() {
    if (phase.value === 'generating') return
    phase.value = 'idle'
    error.value = null
  }

  /** 清空当前练习与生成状态 */
  function reset() {
    activeId += 1
    controller?.abort()
    controller = null
    reading.value = null
    phase.value = 'idle'
    error.value = null
    summary.value = { ...EMPTY_SUMMARY }
  }

  return {
    reading,
    phase,
    error,
    summary,
    isGenerating,
    hasGenerationError,
    setReading,
    generate,
    cancelGeneration,
    dismissGeneration,
    reset,
  }
})
