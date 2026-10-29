/**
 * 每日额度组合式函数
 * 进入首页 / 设置页时取一次 GET /api/quota（后端 md/35 §7.1），给生成入口提供
 * 「今日剩余 N 次」与「额度用尽」两种状态。
 *
 * 用法：const { quotaNote, isBlocked, canGenerate, refresh } = useQuota()
 *
 * 口径与后端一致：blocking === null && primary.remaining > 0 才能生成。
 * 任一维度（账号 / 设备 / 网络）用尽都算 blocked——设备还有次数、但同一网络
 * 用完了，生成照样 429。查询失败按可生成处理（fail-open）：真没额度时后端
 * 建任务仍会返回 429，不能让一次查询失败把用户挡在入口外面。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchQuota } from '../api/quota'
import { describeQuotaExceeded } from '../unit/error-text'

export function useQuota() {
  const quota = ref(null)
  const loading = ref(false)
  const error = ref('')

  let controller = null
  let seq = 0

  async function refresh() {
    // 序列号而不是请求先后：慢的旧请求回来时不能覆盖新结果
    const current = (seq += 1)
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    error.value = ''

    try {
      const data = await fetchQuota({ signal: controller.signal })
      if (current !== seq) return
      quota.value = data || null
    } catch (caught) {
      if (current !== seq) return
      // 主动取消不是失败：保留上一次结果，交给下一次请求覆盖
      if (caught?.name === 'AbortError' || caught?.name === 'CanceledError') return

      quota.value = null
      error.value = caught?.message || ''
    } finally {
      if (current === seq) loading.value = false
    }
  }

  onMounted(refresh)

  onBeforeUnmount(() => {
    controller?.abort()
    controller = null
  })

  const remaining = computed(() => {
    const value = quota.value?.primary?.remaining
    return typeof value === 'number' ? value : null
  })

  const blocking = computed(() => {
    if (!quota.value) return null
    if (quota.value.blocking) return quota.value.blocking

    // 防御：后端正常会把归零项放进 blocking，这里再兜一层
    return quota.value.primary?.remaining === 0 ? quota.value.primary : null
  })

  const isBlocked = computed(() => blocking.value !== null)

  // 额度未知（接口失败）不拦；已知为 0 或任一项用尽都拦
  const canGenerate = computed(
    () => !isBlocked.value && (remaining.value === null || remaining.value > 0),
  )

  const remainingText = computed(() =>
    remaining.value === null ? '' : `今日剩余 ${remaining.value} 次`,
  )

  // 复用 429 的文案：scope 说明是哪一档用尽，resetAt 固定按北京时间展示
  const blockedHint = computed(() => {
    if (!blocking.value) return ''

    return describeQuotaExceeded({
      details: { ...blocking.value, resetAt: quota.value?.resetAt },
    }).hint
  })

  // 入口只放一句：有额度时说剩余，没额度时说为什么、什么时候恢复
  const quotaNote = computed(() => blockedHint.value || remainingText.value)

  return {
    quota,
    loading,
    error,
    remaining,
    blocking,
    isBlocked,
    canGenerate,
    remainingText,
    blockedHint,
    quotaNote,
    refresh,
  }
}
