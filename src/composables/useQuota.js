/**
 * 每日额度组合式函数
 * 进入首页 / 设置页时取一次 GET /api/quota（后端 md/35 §7.1），给生成入口提供
 * 「今日剩余 N 次」与「额度用尽」两种状态。
 *
 * 用法：const { quotaNote, isBlocked, canGenerate, refresh } = useQuota()
 *       useQuota({ enabled: () => auth.isAuthenticated })  // 游客不请求额度与自备 Key
 *
 * 口径与后端一致：blocking === null && primary.remaining > 0 才能生成。
 * 任一维度（账号 / 设备 / 网络）用尽都算 blocked——设备还有次数、但同一网络
 * 用完了，生成照样 429。查询失败按可生成处理（fail-open）：真没额度时后端
 * 建任务仍会返回 429，不能让一次查询失败把用户挡在入口外面。
 *
 * 自备 API Key（md/43 §12）：有 Key 的用户花自己的钱，不占免费额度，
 * 所以额度用尽也不拦。先读 Key 状态再取额度，避免「额度 0 次」先闪一下禁用。
 * 有 Key 时额度文案改成「使用我的 API Key」，不把免费口径说成「今天不能生成」。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fetchQuota } from '../api/quota'
import { describeQuotaExceeded } from '../unit/error-text'
import { useUserApiKey } from './useUserApiKey'

const OWN_KEY_NOTE = '使用我的 API Key，不占用免费次数'

export function useQuota({ enabled = () => true } = {}) {
  const quota = ref(null)
  const loading = ref(false)
  const error = ref('')
  const { hasKey: usingOwnKey, load: loadOwnKey } = useUserApiKey()

  let controller = null
  let seq = 0

  async function refresh() {
    // 游客 / 未启用时不发请求，避免公开页打出 401
    if (!enabled()) return

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

  // 先确认有没有自备 Key，再取额度：顺序反过来时，额度用尽的用户会先看到
  // 「今日剩余 0 次」和禁用按钮，随后才被 Key 状态解开，属于可见的闪动
  onMounted(async () => {
    if (!enabled()) return
    await loadOwnKey()
    await refresh()
  })

  // 登录态可能在页面存活期间变化（例如同页登录 / 掉线）：
  // 启用后补一次请求；停用时清掉旧额度，避免游客看到上一账号的剩余次数
  watch(enabled, (value) => {
    if (!value) {
      seq += 1
      controller?.abort()
      controller = null
      quota.value = null
      error.value = ''
      loading.value = false
      return
    }

    loadOwnKey()
    refresh()
  })

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

  // 有自备 Key 时额度不参与拦截：花的是用户自己的钱，免费额度到 0 也能生成
  const isBlocked = computed(() => !usingOwnKey.value && blocking.value !== null)

  // 额度未知（接口失败）不拦；已知为 0 或任一项用尽都拦
  const canGenerate = computed(
    () =>
      usingOwnKey.value || (!isBlocked.value && (remaining.value === null || remaining.value > 0)),
  )

  const remainingText = computed(() =>
    remaining.value === null ? '' : `今日剩余 ${remaining.value} 次`,
  )

  // 复用 429 的文案：scope 说明是哪一档用尽，resetAt 固定按北京时间展示
  const blockedHint = computed(() => {
    if (usingOwnKey.value || !blocking.value) return ''

    return describeQuotaExceeded({
      details: { ...blocking.value, resetAt: quota.value?.resetAt },
    }).hint
  })

  // 入口只放一句：有自备 Key 时说清不占免费额度；否则有额度说剩余，没额度说为什么
  const quotaNote = computed(() => {
    if (usingOwnKey.value) return OWN_KEY_NOTE
    return blockedHint.value || remainingText.value
  })

  return {
    quota,
    loading,
    error,
    remaining,
    blocking,
    usingOwnKey,
    isBlocked,
    canGenerate,
    remainingText,
    blockedHint,
    quotaNote,
    refresh,
  }
}
