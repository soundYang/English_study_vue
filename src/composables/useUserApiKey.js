/**
 * 自备 API Key 状态
 *
 * 用途：只读取「当前账号有没有可用的自备 Key」，供生成入口判断额度是否还需要拦人、
 *       以及生成页显示「本篇使用我的 API Key」。导入 / 替换 / 删除由个人中心的卡片自己做，
 *       那些操作要维护表单、确认态与逐码错误，放在这里反而多一层转发。
 * 用法：
 *   const { hasKey, loading, load } = useUserApiKey()
 *   await load()
 *
 * 说明：读取失败按「没有 Key」处理（fail-open 到免费额度口径）。
 *       接口 503 USER_API_KEY_DISABLED 也属于这一情形——服务端没开功能时，
 *       生成本来就走免费路径，前端不该因为一次查询失败把入口锁死。
 */
import { computed, ref } from 'vue'
import { fetchApiKey } from '../api/profile'
import { normalizeApiError } from '../errors'

export function useUserApiKey() {
  const enabled = ref(false)
  const key = ref(null)
  const loading = ref(false)
  const error = ref('')

  let seq = 0

  async function load() {
    // 序列号防竞态：后发的请求才算数
    const current = (seq += 1)
    loading.value = true
    error.value = ''

    try {
      const data = await fetchApiKey()
      if (current !== seq) return

      enabled.value = data?.enabled === true
      key.value = data?.key || null
    } catch (caught) {
      if (current !== seq) return

      enabled.value = false
      key.value = null
      error.value = normalizeApiError(caught)?.message || ''
    } finally {
      if (current === seq) loading.value = false
    }
  }

  // enabled 关闭时即使有存量 Key 也不生效：生成侧本就会回落免费路径
  const hasKey = computed(() => enabled.value && Boolean(key.value))

  return { enabled, key, loading, error, hasKey, load }
}
