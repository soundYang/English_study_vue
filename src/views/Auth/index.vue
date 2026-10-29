<script setup>
/**
 * 登录 / 注册页
 *
 * 用途：同一套整屏布局承载两种模式（/login、/register），设计稿的「左图右表单」。
 *       登录在连续失败 5 次后才出现图形验证码；注册始终需要验证码。
 * 用法：路由 /login 与 /register 共用本组件，模式由 route.meta.authMode 决定。
 *
 * 后端契约（md/33 §6.2）：
 *   POST /auth/captcha  → { captchaId, svg, expiresIn }
 *   POST /auth/login    → { token, expiresAt, user }
 *   POST /auth/register → { token, expiresAt, user }（201）
 * 「忘记密码」「第三方登录」后端不做（md/33 §2.2 / §11.6），这里不渲染。
 */
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowRight, BookOpen, Lock, Smartphone, UserRound } from 'lucide-vue-next'
import BaseButton from '../../component/BaseButton.vue'
import AuthField from './component/AuthField.vue'
import CaptchaField from './component/CaptchaField.vue'
import { fetchCaptcha } from '../../api/auth'
import { config } from '../../config'
import { MOCK_DEMO_CREDENTIALS } from '../../mock/adapter'
import { useAuthStore } from '../../stores/model/auth'
import { useToastStore } from '../../stores/model/toast'
import authBg from '../../assets/images/auth-bg.jpg'

const USERNAME_MIN = 3
const USERNAME_MAX = 20
const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/
const PASSWORD_MIN = 8
const PASSWORD_MAX = 64
const PHONE_PATTERN = /^1[3-9]\d{9}$/

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()

const isRegister = computed(() => route.meta.authMode === 'register')
// 登录 / 注册互相切换时保留 redirect，注册成功后才能回到原目标页
const redirectQuery = computed(() =>
  route.query.redirect ? { redirect: route.query.redirect } : {},
)
const submitting = ref(false)
const formError = ref('')
const errors = reactive({
  usernameOrPhone: '',
  username: '',
  phone: '',
  password: '',
  confirmPassword: '',
  captchaCode: '',
})

const loginForm = reactive({ usernameOrPhone: '', password: '', rememberMe: false })
const registerForm = reactive({ username: '', phone: '', password: '', confirmPassword: '' })

const captchaCode = ref('')
const captchaId = ref('')
const captchaSvg = ref('')
const captchaLoading = ref(false)
const loginCaptchaVisible = ref(false)
const captchaRef = ref(null)

// 演示提示只在本地 mock 的开发环境出现，真实后端不会有这组账号
const showDemoHint = computed(() => config.useMock && config.isDev)

function clearErrors() {
  Object.keys(errors).forEach((key) => {
    errors[key] = ''
  })
  formError.value = ''
}

function safeRedirect(value) {
  const target = Array.isArray(value) ? value[0] : value
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) return '/'

  // 登录 / 注册页自己的子路径不能再当回跳目标，否则会绕回表单
  const path = target.split(/[?#]/)[0]
  if (path === '/login' || path === '/register') return '/'
  return target
}

// 「先逛逛，暂不登录」：优先回被拦下的目标页；gate 页（阅读正文 / 结果）回首页，
// 否则刚离开登录页又会被提示登录（md/45 §5.9）
const skipTarget = computed(() => {
  const target = safeRedirect(route.query.redirect)
  const path = target.split(/[?#]/)[0]
  if (path.startsWith('/readings/')) return '/'
  return target
})

// 连点「换一张」时只认最后一次响应，避免旧图覆盖新图
let captchaSeq = 0

async function loadCaptcha() {
  const seq = captchaSeq + 1
  captchaSeq = seq
  captchaLoading.value = true

  try {
    const data = await fetchCaptcha()
    if (seq !== captchaSeq) return
    captchaId.value = data?.captchaId || ''
    captchaSvg.value = data?.svg || ''
  } catch (error) {
    if (seq !== captchaSeq) return
    captchaSvg.value = ''
    formError.value = error?.message || '验证码加载失败，请稍后重试。'
  } finally {
    if (seq === captchaSeq) captchaLoading.value = false
  }
}

/** 用户主动换图：旧错误跟旧图一起清掉 */
function refreshCaptcha() {
  errors.captchaCode = ''
  loadCaptcha()
}

function validateLogin() {
  clearErrors()

  if (!loginForm.usernameOrPhone.trim()) errors.usernameOrPhone = '请输入用户名或手机号'
  if (!loginForm.password) errors.password = '请输入密码'
  if (loginCaptchaVisible.value && !captchaCode.value.trim()) {
    errors.captchaCode = '请输入图形验证码'
  }

  return !errors.usernameOrPhone && !errors.password && !errors.captchaCode
}

function validateRegister() {
  clearErrors()

  const username = registerForm.username.trim()
  if (!username) {
    errors.username = '请输入用户名'
  } else if (username.length < USERNAME_MIN) {
    errors.username = `用户名至少 ${USERNAME_MIN} 个字符`
  } else if (username.length > USERNAME_MAX) {
    errors.username = `用户名最多 ${USERNAME_MAX} 个字符`
  } else if (!USERNAME_PATTERN.test(username)) {
    errors.username = '用户名只能包含字母、数字和下划线'
  }

  const phone = registerForm.phone.trim()
  if (phone && !PHONE_PATTERN.test(phone)) errors.phone = '手机号格式不正确'

  const password = registerForm.password
  if (!password) {
    errors.password = '请输入密码'
  } else if (password.length < PASSWORD_MIN) {
    errors.password = `密码至少 ${PASSWORD_MIN} 位`
  } else if (password.length > PASSWORD_MAX) {
    errors.password = `密码最多 ${PASSWORD_MAX} 位`
  } else if (!/[A-Za-z]/.test(password)) {
    errors.password = '密码需要包含字母'
  } else if (!/\d/.test(password)) {
    errors.password = '密码需要包含数字'
  }

  if (!registerForm.confirmPassword) {
    errors.confirmPassword = '请再输入一次密码'
  } else if (registerForm.confirmPassword !== password) {
    errors.confirmPassword = '两次输入的密码不一致'
  }

  if (!captchaCode.value.trim()) errors.captchaCode = '请输入图形验证码'

  return !Object.values(errors).some(Boolean)
}

function applyServerError(error) {
  const code = error?.code || ''
  const message = error?.message || '操作失败，请稍后重试。'

  if (code === 'CAPTCHA_REQUIRED') {
    // 后端只在「失败 5 次之后」才要求验证码：把这一行插进表单，而不是整页报错
    loginCaptchaVisible.value = true
    errors.captchaCode = message
    loadCaptcha()
    nextTick(() => captchaRef.value?.focus())
    return
  }

  if (code === 'CAPTCHA_INVALID' || code === 'CAPTCHA_EXPIRED') {
    // 验证码一次性，输错也已经作废，必须换图（md/34 §1.3 / §4）
    errors.captchaCode = message
    captchaCode.value = ''
    loadCaptcha()
    return
  }

  if (error?.field && error.field in errors) {
    errors[error.field] = message
    return
  }

  if (code === 'AUTH_INVALID_CREDENTIALS') {
    errors.password = message
    return
  }

  formError.value = message
}

async function submitLogin() {
  if (submitting.value) return
  if (!validateLogin()) return

  submitting.value = true
  try {
    await auth.login({
      usernameOrPhone: loginForm.usernameOrPhone.trim(),
      password: loginForm.password,
      rememberMe: loginForm.rememberMe,
      ...(loginCaptchaVisible.value
        ? { captchaId: captchaId.value, captchaCode: captchaCode.value.trim() }
        : {}),
    })
    toast.push({ type: 'success', message: `欢迎回来，${auth.displayName || '同学'}` })
    await router.replace(safeRedirect(route.query.redirect))
  } catch (error) {
    applyServerError(error)
    // 带了验证码仍然失败（比如密码错）：这张码已经消耗，换一张再让用户重试
    if (loginCaptchaVisible.value && !String(error?.code || '').startsWith('CAPTCHA_')) {
      captchaCode.value = ''
      refreshCaptcha()
    }
  } finally {
    submitting.value = false
  }
}

async function submitRegister() {
  if (submitting.value) return
  if (!validateRegister()) return

  submitting.value = true
  try {
    await auth.register({
      username: registerForm.username.trim(),
      password: registerForm.password,
      phone: registerForm.phone.trim() || undefined,
      captchaId: captchaId.value,
      captchaCode: captchaCode.value.trim(),
    })
    toast.push({ type: 'success', message: '注册成功，欢迎加入' })
    await router.replace(safeRedirect(route.query.redirect))
  } catch (error) {
    applyServerError(error)
    // 只要请求到了服务端，这张验证码就已经被消耗，换一张避免下一次必然过期
    if (!String(error?.code || '').startsWith('CAPTCHA_')) {
      captchaCode.value = ''
      refreshCaptcha()
    }
  } finally {
    submitting.value = false
  }
}

watch(
  () => route.name,
  (name) => {
    clearErrors()
    captchaCode.value = ''
    loginCaptchaVisible.value = false
    if (name === 'register') loadCaptcha()
  },
)

onMounted(() => {
  if (isRegister.value) loadCaptcha()
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-visual" aria-hidden="true">
      <img :src="authBg" alt="" />
    </div>

    <main class="auth-main">
      <section class="auth-card">
        <header class="auth-brand">
          <span class="auth-mark" aria-hidden="true">
            <BookOpen :size="22" :stroke-width="1.6" />
          </span>
          <h1 class="auth-title">英语阅读训练</h1>
          <p class="auth-tagline">用阅读，遇见更好的自己</p>
        </header>

        <nav class="auth-tabs" aria-label="登录或注册">
          <RouterLink
            :to="{ name: 'login', query: redirectQuery }"
            class="auth-tab"
            :class="{ 'is-active': !isRegister }"
            :aria-current="!isRegister ? 'page' : undefined"
          >
            登录
          </RouterLink>
          <RouterLink
            :to="{ name: 'register', query: redirectQuery }"
            class="auth-tab"
            :class="{ 'is-active': isRegister }"
            :aria-current="isRegister ? 'page' : undefined"
          >
            注册
          </RouterLink>
        </nav>

        <form v-if="!isRegister" class="auth-form" novalidate @submit.prevent="submitLogin">
          <AuthField
            v-model="loginForm.usernameOrPhone"
            label="用户名或手机号"
            name="usernameOrPhone"
            placeholder="用户名 / 手机号"
            :icon="UserRound"
            autocomplete="username"
            :error="errors.usernameOrPhone"
          />

          <AuthField
            v-model="loginForm.password"
            label="密码"
            name="password"
            type="password"
            placeholder="密码"
            :icon="Lock"
            autocomplete="current-password"
            :error="errors.password"
          />

          <div class="auth-options">
            <label class="auth-checkbox">
              <input v-model="loginForm.rememberMe" type="checkbox" />
              <span>记住账号</span>
            </label>
          </div>

          <CaptchaField
            v-if="loginCaptchaVisible"
            ref="captchaRef"
            v-model="captchaCode"
            :svg="captchaSvg"
            :loading="captchaLoading"
            :error="errors.captchaCode"
            @refresh="refreshCaptcha"
          />

          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

          <BaseButton type="submit" size="lg" block :loading="submitting">登录</BaseButton>

          <p class="auth-switch">
            还没有账号？
            <RouterLink :to="{ name: 'register', query: redirectQuery }">立即注册</RouterLink>
          </p>

          <p v-if="showDemoHint" class="auth-demo">
            Mock 演示账号：{{ MOCK_DEMO_CREDENTIALS.username }} /
            {{ MOCK_DEMO_CREDENTIALS.password }}
          </p>
        </form>

        <form v-else class="auth-form" novalidate @submit.prevent="submitRegister">
          <AuthField
            v-model="registerForm.username"
            label="用户名"
            name="username"
            placeholder="用户名（3–20 位字母、数字或下划线）"
            :icon="UserRound"
            autocomplete="username"
            :maxlength="USERNAME_MAX"
            :error="errors.username"
          />

          <AuthField
            v-model="registerForm.phone"
            label="手机号"
            name="phone"
            placeholder="手机号"
            :icon="Smartphone"
            autocomplete="tel"
            inputmode="tel"
            :maxlength="11"
            :error="errors.phone"
          />

          <CaptchaField
            ref="captchaRef"
            v-model="captchaCode"
            :svg="captchaSvg"
            :loading="captchaLoading"
            :error="errors.captchaCode"
            @refresh="refreshCaptcha"
          />

          <AuthField
            v-model="registerForm.password"
            label="密码"
            name="password"
            type="password"
            placeholder="密码（8–64 位，含字母和数字）"
            :icon="Lock"
            autocomplete="new-password"
            :maxlength="PASSWORD_MAX"
            :error="errors.password"
          />

          <AuthField
            v-model="registerForm.confirmPassword"
            label="确认密码"
            name="confirmPassword"
            type="password"
            placeholder="确认密码"
            :icon="Lock"
            autocomplete="new-password"
            :maxlength="PASSWORD_MAX"
            :error="errors.confirmPassword"
          />

          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

          <BaseButton type="submit" size="lg" block :loading="submitting">注册</BaseButton>

          <p class="auth-switch">
            已有账号？
            <RouterLink :to="{ name: 'login', query: redirectQuery }">立即登录</RouterLink>
          </p>
        </form>

        <!-- 不登录也能浏览网站：入口放在两个 tab 共用的卡片底部（md/45 §5.9） -->
        <RouterLink class="auth-skip" :to="skipTarget" aria-label="不登录，先浏览网站">
          先逛逛，暂不登录
          <ArrowRight :size="16" :stroke-width="1.8" aria-hidden="true" />
        </RouterLink>
      </section>
    </main>
  </div>
</template>

<style scoped>
.auth-page {
  display: grid;
  grid-template-columns: minmax(0, 1.04fr) minmax(0, 1fr);
  min-height: 100vh;
  background: #f6f0e2;
}

.auth-visual {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}

/* 图片绝对定位：不用 1386px 的原始高度把整行撑高，表单才能稳稳居中 */
.auth-visual img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* 原图是竖版：横屏裁切时保住顶部的题字，别把整段手写句切掉 */
  object-position: 50% 20%;
}

/* 图片右缘淡出，让表单卡的奶油底自然过渡到窗外光里 */
.auth-visual::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(246, 240, 226, 0) 58%, rgba(246, 240, 226, 0.92) 100%);
  content: '';
}

.auth-main {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-10) var(--space-8);
}

.auth-card {
  width: min(420px, 100%);
  padding: 40px 40px 32px;
  border: 1px solid rgba(120, 130, 110, 0.18);
  border-radius: 28px;
  background: rgba(252, 248, 239, 0.88);
  box-shadow: 0 30px 60px rgba(60, 70, 55, 0.12);
  backdrop-filter: blur(14px);
}

.auth-brand {
  display: grid;
  justify-items: center;
  gap: 6px;
  text-align: center;
}

.auth-mark {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-bottom: 4px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-surface);
  box-shadow: 0 8px 18px rgba(47, 80, 59, 0.24);
}

.auth-title {
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 30px;
  letter-spacing: 0.06em;
}

.auth-tagline {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  letter-spacing: 0.14em;
}

.auth-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 26px 0 22px;
  border-bottom: 1px solid var(--color-line);
}

.auth-tab {
  position: relative;
  padding: 10px 0 12px;
  color: var(--color-muted);
  font-size: var(--text-body);
  text-align: center;
  text-decoration: none;
  transition: color var(--dur-fast) var(--ease-out);
}

.auth-tab:hover {
  color: var(--color-ink-2);
}

.auth-tab.is-active {
  color: var(--color-ink);
  font-weight: 600;
}

.auth-tab.is-active::after {
  position: absolute;
  right: 24%;
  bottom: -1px;
  left: 24%;
  height: 2px;
  border-radius: 2px;
  background: var(--color-primary);
  content: '';
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-options {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-top: -2px;
}

.auth-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-muted);
  font-size: var(--text-caption);
  cursor: pointer;
}

.auth-checkbox input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.form-error {
  color: var(--color-danger);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.auth-switch {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: var(--text-caption);
  text-align: center;
}

.auth-switch a {
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: none;
}

.auth-switch a:hover {
  text-decoration: underline;
}

.auth-demo {
  margin-top: -4px;
  color: var(--color-muted);
  font-size: 12px;
  text-align: center;
}

.auth-skip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  margin-top: var(--space-4);
  color: var(--color-muted);
  font-size: var(--text-small);
  text-decoration: none;
}

.auth-skip:hover {
  color: var(--color-ink);
  text-decoration: underline;
  text-underline-offset: 4px;
}

@media (max-width: 1023px) {
  .auth-page {
    grid-template-columns: minmax(0, 1fr);
  }

  .auth-visual {
    display: none;
  }

  .auth-main {
    padding: var(--space-10) var(--space-6);
  }
}

@media (max-width: 767px) {
  .auth-main {
    padding: var(--space-6) var(--space-4);
  }

  .auth-card {
    padding: 28px 22px 24px;
    border-radius: 22px;
    background: rgba(252, 248, 239, 0.95);
  }

  .auth-title {
    font-size: 20px;
    line-height: 28px;
  }

  .auth-tabs {
    margin: 20px 0 18px;
  }
}
</style>
