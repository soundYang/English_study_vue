<script setup>
/**
 * 后台登录
 *
 * 用途：`/admin/login` 独立整屏。账号 + 密码换管理员令牌（12 小时），
 *       成功后直接进概览；`/api/admin/*` 整体 404 时显示配置缺失卡。
 * 用法：路由 `/admin/login`（meta.admin + meta.bare）。
 *
 * 状态：
 *   - 401 ADMIN_AUTH_FAILED → 「账号或密码不正确」，不清空已输入的账号
 *   - 429 RATE_LIMITED      → 原样展示后端 message（5 次失败 / 15 分钟）
 *   - 404 ADMIN_NOT_CONFIGURED → 全屏配置卡，不显示成密码错误
 *   - 会话过期跳回本页时，adminAuth.notice 提供「登录已过期」提示
 */
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ShieldCheck } from 'lucide-vue-next'
import BaseButton from '../../component/BaseButton.vue'
import BaseInput from '../../component/BaseInput.vue'
import { adminLogin, fetchAdminMe } from '../api/auth'
import { adminAuth } from '../auth'

const route = useRoute()
const router = useRouter()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const sessionNotice = ref(adminAuth.takeNotice())
const configMissing = ref(false)
const usernameRef = ref(null)

/** 只回跳后台内部路径，避免 ?redirect= 被拿来跳到站外或登录页自身 */
function safeRedirect() {
  const raw = Array.isArray(route.query.redirect) ? route.query.redirect[0] : route.query.redirect
  if (typeof raw !== 'string' || !raw.startsWith('/admin') || raw.startsWith('//')) return '/admin'

  const path = raw.split(/[?#]/)[0]
  if (path === '/admin/login') return '/admin'
  return raw
}

function handleError(error) {
  const code = error?.code || ''

  if (code === 'ADMIN_NOT_CONFIGURED') {
    configMissing.value = true
    errorMessage.value = ''
    return
  }
  if (code === 'ADMIN_AUTH_FAILED') {
    errorMessage.value = '账号或密码不正确'
    return
  }
  if (code === 'RATE_LIMITED') {
    errorMessage.value = error.message || '登录失败次数过多，请稍后再试。'
    return
  }

  errorMessage.value = error?.message || '登录没有成功，请稍后重试。'
}

/** 登录响应里没有 username：补一次 /auth/me；失败不阻断登录 */
async function hydrateUsername() {
  try {
    const me = await fetchAdminMe()
    if (me?.username) adminAuth.setUsername(me.username)
  } catch {
    // 输入框的值已经作为兜底显示名写入会话；下次导航守卫仍会校验令牌
  }
}

async function handleSubmit() {
  if (submitting.value) return

  errorMessage.value = ''
  sessionNotice.value = ''

  const account = username.value.trim()
  if (!account || !password.value) {
    errorMessage.value = '请输入账号和密码'
    return
  }

  submitting.value = true

  try {
    const session = await adminLogin({ username: account, password: password.value })
    adminAuth.setSession({
      token: session.token,
      expiresAt: session.expiresAt,
      username: account,
    })
    hydrateUsername()
    router.replace(safeRedirect())
  } catch (error) {
    handleError(error)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  usernameRef.value?.focus()
})
</script>

<template>
  <main class="admin-login">
    <section class="login-card">
      <div class="brand-mark" aria-hidden="true">
        <ShieldCheck :size="22" :stroke-width="1.6" />
      </div>

      <h1 class="title">管理后台</h1>
      <p class="subtitle">Word Reading · 管理员入口</p>

      <div v-if="configMissing" class="config-block" role="alert">
        <p class="config-title">后台未配置</p>
        <p class="config-text">
          后端未设置 ADMIN_USERNAME / ADMIN_PASSWORD_HASH。配置后需重启服务。
        </p>
      </div>

      <form v-else class="login-form" @submit.prevent="handleSubmit">
        <p v-if="sessionNotice" class="notice" role="status">{{ sessionNotice }}</p>

        <BaseInput
          ref="usernameRef"
          v-model="username"
          label="账号"
          autocomplete="username"
          :disabled="submitting"
        />

        <div class="field">
          <div class="field-head">
            <label class="field-label" for="admin-password">密码</label>
            <button
              type="button"
              class="field-toggle"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? '隐藏' : '显示' }}
            </button>
          </div>
          <BaseInput
            id="admin-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            :disabled="submitting"
          />
        </div>

        <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

        <BaseButton type="submit" size="lg" block :loading="submitting">登录</BaseButton>
      </form>

      <p v-if="!configMissing" class="hint">登录有效期 12 小时</p>
    </section>
  </main>
</template>

<style scoped>
.admin-login {
  display: grid;
  place-items: center;
  min-height: 100dvh;
  padding: var(--space-6);
  background: var(--color-bg);
}

.login-card {
  width: 420px;
  max-width: 100%;
  padding: var(--space-10) var(--space-8) var(--space-8);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  text-align: center;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: 0 auto var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-sidebar);
  color: var(--color-sidebar-text);
}

.title {
  font-family: var(--font-display);
  font-size: 28px;
  line-height: 36px;
}

.subtitle {
  margin-top: var(--space-1);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  letter-spacing: 0.02em;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: var(--space-8);
  text-align: left;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.field-label {
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.field-toggle {
  padding: 0 2px;
  border: none;
  background: none;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  cursor: pointer;
}

.field-toggle:hover {
  color: var(--color-ink-2);
}

.field-toggle:focus-visible {
  outline: none;
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.error,
.notice {
  padding: 10px var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.error {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.notice {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.config-block {
  margin-top: var(--space-8);
  padding: var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-warning-bg);
  color: var(--color-warning);
  text-align: left;
}

.config-title {
  font-size: var(--text-body);
  font-weight: 500;
  line-height: var(--leading-body);
}

.config-text {
  margin-top: var(--space-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.hint {
  margin-top: var(--space-5);
  color: var(--color-muted-2);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

@media (max-width: 479px) {
  .login-card {
    padding: var(--space-8) var(--space-5) var(--space-6);
  }

  .title {
    font-size: 24px;
    line-height: 32px;
  }

  /* 移动端输入框 16px，避免 iOS 聚焦时页面自动放大 */
  .login-form :deep(.input-control) {
    font-size: 16px;
  }
}
</style>
