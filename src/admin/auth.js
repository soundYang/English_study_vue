/**
 * 管理端会话
 *
 * 用途：保存管理员令牌、显示名与过期时间，供后台请求层与路由守卫读取。
 *       与用户会话完全隔离：独立的 `wr.admin.*` 键，12 小时固定有效期。
 * 用法：`adminAuth.hasValidToken()` 判断能否进后台；登录成功后 `adminAuth.setSession()`。
 *
 * 说明：
 *   - 不建 Pinia store：只有四个字段，且请求层（非组件）要读，模块级 reactive 更直接。
 *   - 模块加载时自动 restore：路由守卫在首次导航前就要能读到本地令牌。
 *   - 不在任何地方打印令牌或密码（md/40 §2.3）。
 */
import { reactive } from 'vue'
import { localStore } from '../unit/storage'

const TOKEN_KEY = 'wr.admin.token'
const EXPIRES_KEY = 'wr.admin.expiresAt'
const USERNAME_KEY = 'wr.admin.username'

/** 时间是后端给的 UTC ISO 字符串；解析失败按「已过期」处理，宁可多登一次 */
function parseTime(value) {
  const ts = Date.parse(value)
  return Number.isFinite(ts) ? ts : 0
}

export const adminAuth = reactive({
  token: '',
  username: '',
  expiresAt: '',
  /** 跳转期间传递的一次性提示（如「登录已过期」），登录页读取后清空 */
  notice: '',

  get isExpired() {
    return !this.expiresAt || parseTime(this.expiresAt) <= Date.now()
  },

  hasValidToken() {
    return Boolean(this.token) && !this.isExpired
  },

  /** 登录成功后写入内存与本地存储；username 可先用输入值兜底，再用 /auth/me 覆盖 */
  setSession({ token = '', expiresAt = '', username = '' } = {}) {
    this.token = token || ''
    this.expiresAt = expiresAt || ''
    this.username = username || ''

    localStore.set(TOKEN_KEY, this.token)
    localStore.set(EXPIRES_KEY, this.expiresAt)
    localStore.set(USERNAME_KEY, this.username)
  },

  /** /auth/me 只补显示名，不动令牌 */
  setUsername(username) {
    this.username = username || ''
    localStore.set(USERNAME_KEY, this.username)
  },

  /** 清空会话；传入 notice 时留给登录页展示（过期跳转用） */
  clear(notice = '') {
    this.token = ''
    this.expiresAt = ''
    this.username = ''
    this.notice = notice || ''

    localStore.remove(TOKEN_KEY)
    localStore.remove(EXPIRES_KEY)
    localStore.remove(USERNAME_KEY)
  },

  /** 读一次即清，避免刷新或二次跳转时重复显示同一条提示 */
  takeNotice() {
    const notice = this.notice
    this.notice = ''
    return notice
  },

  /** 启动时从本地恢复；过期或残缺直接清掉，不在界面上留一个「看似登录」的空壳 */
  restore() {
    const token = localStore.get(TOKEN_KEY, '')
    const expiresAt = localStore.get(EXPIRES_KEY, '')
    const username = localStore.get(USERNAME_KEY, '')

    this.token = typeof token === 'string' ? token : ''
    this.expiresAt = typeof expiresAt === 'string' ? expiresAt : ''
    this.username = typeof username === 'string' ? username : ''

    if (!this.token || parseTime(this.expiresAt) <= Date.now()) this.clear()
  },
})

adminAuth.restore()
