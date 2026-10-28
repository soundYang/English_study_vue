/**
 * 登录状态
 * 令牌是唯一凭据：写入 localStorage 的 accessToken 后，request.js 会自动带上 Bearer。
 * 用户资料另存一份缓存，刷新页面时顶栏先显示昵称，再由 restore() 与后端对齐。
 * 判「登录失效」只认错误码 AUTH_REQUIRED，不用 instanceof AuthError（md/33 §6.4）。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { loginAccount, logoutAccount, registerAccount } from '../../api/auth'
import { fetchProfile } from '../../api/profile'
import { normalizeApiError } from '../../errors'
import { localStore, storageKeys } from '../../unit/storage'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(localStore.get(storageKeys.authUser, null))
  const token = ref(localStore.get(storageKeys.accessToken, ''))
  const restoring = ref(false)

  const isAuthenticated = computed(() => Boolean(token.value))
  const displayName = computed(() =>
    String(user.value?.nickname || user.value?.username || '').trim(),
  )
  // 顶栏头像只放一个字；中文取第一个字，英文取首字母大写
  const initial = computed(() => {
    const name = displayName.value
    return name ? Array.from(name)[0].toUpperCase() : 'S'
  })

  function persistSession(nextToken, nextUser) {
    token.value = nextToken || ''
    user.value = nextUser || null

    if (nextToken) localStore.set(storageKeys.accessToken, nextToken)
    else localStore.remove(storageKeys.accessToken)

    if (nextUser) localStore.set(storageKeys.authUser, nextUser)
    else localStore.remove(storageKeys.authUser)
  }

  function clearSession() {
    persistSession('', null)
  }

  /**
   * 登录；成功后令牌与用户都已落盘，调用方只负责跳转。
   * mock 抛的是 MockApiError（code 在 .error 里），这里统一归一化，
   * 页面无论跑在哪种数据源上都只认 error.code。
   */
  async function login(payload) {
    try {
      const data = await loginAccount(payload)
      persistSession(data.token, data.user)
      return data.user
    } catch (error) {
      throw normalizeApiError(error)
    }
  }

  /** 注册即登录 */
  async function register(payload) {
    try {
      const data = await registerAccount(payload)
      persistSession(data.token, data.user)
      return data.user
    } catch (error) {
      throw normalizeApiError(error)
    }
  }

  /** 退出：接口失败也要清本地，避免用户卡在「退不出去」的状态 */
  async function logout() {
    try {
      await logoutAccount()
    } catch {
      // 服务端是否成功撤销会话不该拦住本地退出；令牌已不再使用
    } finally {
      clearSession()
    }
  }

  /**
   * 用当前令牌换一次资料。
   * 只有明确「没登录 / 令牌失效」时才清会话；断网等临时错误保留缓存，避免把用户误登出。
   */
  async function restore() {
    if (!token.value || restoring.value) return user.value

    restoring.value = true
    try {
      const data = await fetchProfile()
      if (data?.user) {
        user.value = data.user
        localStore.set(storageKeys.authUser, data.user)
      }
    } catch (error) {
      if (error?.code === 'AUTH_REQUIRED' || error?.name === 'AuthError') clearSession()
    } finally {
      restoring.value = false
    }

    return user.value
  }

  /** 资料弹窗保存成功后同步顶栏与缓存 */
  function updateUser(nextUser) {
    if (!nextUser) return
    user.value = nextUser
    localStore.set(storageKeys.authUser, nextUser)
  }

  return {
    user,
    token,
    restoring,
    isAuthenticated,
    displayName,
    initial,
    login,
    register,
    logout,
    restore,
    updateUser,
    clearSession,
  }
})
