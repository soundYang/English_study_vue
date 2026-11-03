/**
 * 词源兜底提示（后端 md/60）
 *
 * 兜底可能出现在三处，字段名有两种：
 *   - 生成任务 DTO / 阅读详情：顶层 `vocabFallback`
 *   - 预检 `/capacity`：`levels[level].fallback`
 * 两者的结构一致，都是 `used / requestedScope / scopeAvailable / allAvailable /
 * needed / supplemented / message`。
 *
 * 前端只负责展示 `message`：它是后端用同一份 SCOPE_LABELS 生成的中文，
 * 前端再拼一次「今天新学 / 全部词汇」迟早会和后端叫法漂移。
 * 字段不存在、`used !== true` 或 `message` 为空，一律按「没有兜底」处理。
 */

/** 取出真正的兜底记录：兼容两种字段名，只认 used === true */
function fallbackRecordOf(source) {
  if (!source || typeof source !== 'object') return null

  const record = source.vocabFallback ?? source.fallback
  return record && record.used === true ? record : null
}

/**
 * @returns {{ used: true, message: string } & Record<string, unknown> | null}
 */
export function vocabFallbackOf(source) {
  const record = fallbackRecordOf(source)
  if (!record) return null

  const message = typeof record.message === 'string' ? record.message.trim() : ''
  if (!message) return null

  return { ...record, message }
}
