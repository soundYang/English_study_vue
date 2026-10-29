/**
 * 生成能力预检
 * 设置页与首页共用：参数变化时防抖预检一次，返回三档门禁与篇幅上限。
 * 与真实生成调的是同一个接口，预检说能写什么，生成就一定接受什么。
 *
 * 用法：const { capacity, loading, error, load, levelGate, maxTargetWords, dispose } = useCapacity()
 *       load({ targetWords: 200 })
 */
import { ref, watch } from 'vue'
import { fetchCapacity } from '../api/readings'

const DEBOUNCE_MS = 250

export function useCapacity({ enabled = () => true } = {}) {
  const capacity = ref(null)
  const loading = ref(false)
  const error = ref('')

  let timer = null
  let controller = null
  let seq = 0

  async function run(params) {
    // 游客不预检：公开页不该打受保护接口（md/45 §5.4）
    if (!enabled()) return

    // 序列号而不是请求先后：慢的旧请求回来时不能覆盖新参数的结果
    const current = (seq += 1)
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    error.value = ''

    try {
      const data = await fetchCapacity(params, { signal: controller.signal })
      if (current !== seq) return
      capacity.value = data
    } catch (caught) {
      if (current !== seq) return
      // 主动取消不是失败：把旧的预检结果留在界面上，等下一次请求覆盖
      if (caught?.name === 'AbortError' || caught?.name === 'CanceledError') return

      capacity.value = null
      error.value = caught?.message || '预检失败，生成时以后端结果为准'
    } finally {
      if (current === seq) loading.value = false
    }
  }

  function load(params) {
    if (!enabled()) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => run(params), DEBOUNCE_MS)
  }

  // 登录态变化：停用就清掉上一次账号的预检结果；重新启用等调用方的 load 自然触发
  watch(enabled, (value) => {
    if (value) return
    if (timer) clearTimeout(timer)
    timer = null
    controller?.abort()
    controller = null
    seq += 1
    capacity.value = null
    error.value = ''
    loading.value = false
  })

  function levelGate(level) {
    return capacity.value?.levels?.[level] || null
  }

  function maxTargetWords(level) {
    return levelGate(level)?.maxTargetWords || 0
  }

  function dispose() {
    if (timer) clearTimeout(timer)
    timer = null
    controller?.abort()
    controller = null
  }

  return { capacity, loading, error, load, levelGate, maxTargetWords, dispose }
}
