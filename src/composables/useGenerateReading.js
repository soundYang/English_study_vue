/**
 * 生成阅读组合式函数
 * 视图与全局覆盖层通过它读写生成状态；请求、取消与错误归一化由 reading store 负责。
 *
 * 用法：const { phase, error, summary, isGenerating, start, cancel, dismiss } = useGenerateReading()
 *       const reading = await start(payload, { availableWords })
 */
import { storeToRefs } from 'pinia'
import { useReadingStore } from '../stores/model/reading'

export function useGenerateReading() {
  const store = useReadingStore()
  const { phase, error, summary, isGenerating, hasGenerationError } = storeToRefs(store)

  return {
    phase,
    error,
    summary,
    isGenerating,
    hasGenerationError,
    start: (payload, options) => store.generate(payload, options),
    cancel: () => store.cancelGeneration(),
    dismiss: () => store.dismissGeneration(),
    reset: () => store.reset(),
  }
}
