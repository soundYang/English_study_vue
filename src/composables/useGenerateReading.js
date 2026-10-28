/**
 * 生成阅读组合式函数
 * 视图与全局覆盖层通过它读写生成状态；建任务、轮询、取消、重试与错误归一化由 reading store 负责。
 *
 * 用法：const {
 *         phase, error, summary, task, taskId, cancelling, isGenerating,
 *         start, resume, retry, cancel, dismiss,
 *       } = useGenerateReading()
 *       start(payload, { availableWords, from })
 *
 * 说明：start 只负责建任务并启动轮询，不等文章；成功以 reading / phase = answering 为准。
 */
import { storeToRefs } from 'pinia'
import { useReadingStore } from '../stores/model/reading'

export function useGenerateReading() {
  const store = useReadingStore()
  const { phase, error, summary, task, taskId, cancelling, isGenerating, hasGenerationError } =
    storeToRefs(store)

  return {
    phase,
    error,
    summary,
    task,
    taskId,
    cancelling,
    isGenerating,
    hasGenerationError,
    start: (payload, options) => store.generate(payload, options),
    resume: () => store.resumeGeneration(),
    retry: () => store.retryGeneration(),
    cancel: () => store.cancelGeneration(),
    dismiss: () => store.dismissGeneration(),
    reset: () => store.reset(),
  }
}
