/**
 * 生成任务交接单
 *
 * 用途：首页 / 设置页点「开始生成」后，只把这次要发的参数交给 /generating，
 *       由生成页真正发起请求——纸页动画和请求必须在同一页里，等待才看得见。
 * 用法：setGenerationHandoff(payload, { availableWords, from: '/settings' })
 *       const handoff = takeGenerationHandoff()
 *
 * 只存在内存里：刷新或直接访问 /generating 时拿不到；这时生成页改从 localStorage
 * 的 taskId 续上轮询（后端 md/32 §5），连任务也没有才退回设置页。
 * 交接单取一次就清空，避免返回上一页时用旧参数又发一次请求。
 */
let pending = null

export function setGenerationHandoff(payload, options = {}) {
  pending = {
    payload: { ...payload },
    availableWords: options.availableWords ?? null,
    from: options.from || '/settings',
  }
}

export function takeGenerationHandoff() {
  const current = pending
  pending = null
  return current
}

/** 交接单还没被生成页取走：入口页据此挡住双击造成的第二份参数 */
export function hasGenerationHandoff() {
  return pending !== null
}

export function clearGenerationHandoff() {
  pending = null
}
