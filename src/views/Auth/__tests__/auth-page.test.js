/**
 * 登录 / 注册页测试
 * 覆盖标签切换、前端校验、登录成功跳转、连续失败后的验证码行、
 * 注册成功即登录与验证码错误后换图；接口层用 stub，不依赖 mock adapter 的内部状态。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AuthPage from '../index.vue'
import { MockApiError } from '../../../mock/adapter'
import { fetchCaptcha, loginAccount, registerAccount } from '../../../api/auth'
import { localStore, storageKeys } from '../../../unit/storage'

vi.mock('../../../api/auth', () => ({
  fetchCaptcha: vi.fn(),
  loginAccount: vi.fn(),
  registerAccount: vi.fn(),
  logoutAccount: vi.fn(),
}))

const CAPTCHA = {
  captchaId: 'mock_test',
  svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  expiresIn: 300,
}

const StubView = { template: '<div class="stub-view"></div>' }

let wrapper = null
let router = null

async function mountPage(path = '/login') {
  const pinia = createPinia()
  setActivePinia(pinia)

  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: StubView },
      { path: '/profile', name: 'profile', component: StubView },
      {
        path: '/login',
        name: 'login',
        component: AuthPage,
        meta: { bare: true, authMode: 'login' },
      },
      {
        path: '/register',
        name: 'register',
        component: AuthPage,
        meta: { bare: true, authMode: 'register' },
      },
    ],
  })

  await router.push(path)
  await router.isReady()

  wrapper = mount(AuthPage, {
    global: { plugins: [pinia, router] },
  })
  await flushPromises()

  return wrapper
}

async function fillLogin({ identifier = 'Sound', password = 'demo1234' } = {}) {
  await wrapper.get('input[name="usernameOrPhone"]').setValue(identifier)
  await wrapper.get('input[name="password"]').setValue(password)
}

async function fillRegister(overrides = {}) {
  const values = {
    username: 'reader_01',
    phone: '',
    captchaCode: 'ABCD',
    password: 'read2026',
    confirmPassword: 'read2026',
    ...overrides,
  }

  await wrapper.get('input[name="username"]').setValue(values.username)
  await wrapper.get('input[name="phone"]').setValue(values.phone)
  await wrapper.get('input[name="captchaCode"]').setValue(values.captchaCode)
  await wrapper.get('input[name="password"]').setValue(values.password)
  await wrapper.get('input[name="confirmPassword"]').setValue(values.confirmPassword)
}

async function submit() {
  await wrapper.get('form.auth-form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(fetchCaptcha)
    .mockReset()
    .mockResolvedValue({ ...CAPTCHA })
  vi.mocked(loginAccount).mockReset()
  vi.mocked(registerAccount).mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('Auth page', () => {
  it('should switch between login and register without leaving the page', async () => {
    await mountPage('/login')

    expect(wrapper.find('input[name="usernameOrPhone"]').exists()).toBe(true)
    expect(wrapper.find('input[name="confirmPassword"]').exists()).toBe(false)

    await wrapper.findAll('.auth-tab')[1].trigger('click')
    await flushPromises()
    await nextTick()

    expect(router.currentRoute.value.name).toBe('register')
    expect(wrapper.find('input[name="username"]').exists()).toBe(true)
    expect(wrapper.find('input[name="confirmPassword"]').exists()).toBe(true)
    expect(wrapper.find('input[name="usernameOrPhone"]').exists()).toBe(false)
    // 注册一进来就要验证码
    expect(fetchCaptcha).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.captcha-image img').attributes('src')).toContain('data:image/svg+xml')
  })

  it('should state the free quota and token giveaway in one shared notice', async () => {
    await mountPage('/login')

    // 福利只在标签页下方说一次：两个 tab 共用，不散落到表单里
    expect(wrapper.findAll('.auth-offer')).toHaveLength(1)
    const offer = wrapper.get('.auth-offer').text()
    expect(offer).toContain('登录后每日 3 次免费生成文章')
    expect(offer).toContain('2 亿 token 先到先得')

    await mountPage('/register')
    expect(wrapper.findAll('.auth-offer')).toHaveLength(1)
  })

  it('should let the user close the notice only until the page reloads', async () => {
    await mountPage('/login')

    await wrapper.get('.auth-offer-close').trigger('click')

    expect(wrapper.find('.auth-offer').exists()).toBe(false)

    // 关闭只对当前页面生效，不落盘：刷新（重新挂载）后重新出现
    await mountPage('/login')
    expect(wrapper.find('.auth-offer').exists()).toBe(true)
  })

  it('should keep the redirect target when switching to register', async () => {
    await mountPage('/login?redirect=/profile')

    await wrapper.findAll('.auth-tab')[1].trigger('click')
    await flushPromises()
    await nextTick()

    expect(router.currentRoute.value.name).toBe('register')
    expect(router.currentRoute.value.query.redirect).toBe('/profile')
  })

  it('should reject an empty login form before calling the api', async () => {
    await mountPage('/login')
    await submit()

    const errors = wrapper.findAll('.field-error').map((node) => node.text())
    expect(errors).toContain('请输入用户名或手机号')
    expect(errors).toContain('请输入密码')
    expect(loginAccount).not.toHaveBeenCalled()
  })

  it('should log in and honour the redirect query', async () => {
    await mountPage('/login?redirect=/profile')
    vi.mocked(loginAccount).mockResolvedValue({
      token: 'token-1',
      expiresAt: '2026-10-30T00:00:00.000Z',
      user: { id: 'local-user', username: 'Sound', nickname: 'Sound' },
    })

    await fillLogin()
    await submit()

    expect(loginAccount).toHaveBeenCalledWith({
      usernameOrPhone: 'Sound',
      password: 'demo1234',
      rememberMe: false,
    })
    expect(localStore.get(storageKeys.accessToken)).toBe('token-1')
    expect(router.currentRoute.value.fullPath).toBe('/profile')
  })

  it('should show the captcha row only after CAPTCHA_REQUIRED', async () => {
    await mountPage('/login')
    vi.mocked(loginAccount).mockRejectedValue(
      new MockApiError(
        'CAPTCHA_REQUIRED',
        '登录失败次数较多，请输入图形验证码后重试',
        400,
        'captchaCode',
      ),
    )

    await fillLogin({ password: 'wrong2026' })
    await submit()

    expect(wrapper.find('input[name="captchaCode"]').exists()).toBe(true)
    expect(fetchCaptcha).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('登录失败次数较多')

    // 用户补上验证码后，下一次请求会带上 captchaId / captchaCode
    vi.mocked(loginAccount).mockResolvedValue({
      token: 'token-2',
      expiresAt: '2026-10-30T00:00:00.000Z',
      user: { id: 'local-user', username: 'Sound', nickname: 'Sound' },
    })
    await wrapper.get('input[name="captchaCode"]').setValue('ABCD')
    await submit()

    expect(loginAccount).toHaveBeenLastCalledWith({
      usernameOrPhone: 'Sound',
      password: 'wrong2026',
      rememberMe: false,
      captchaId: CAPTCHA.captchaId,
      captchaCode: 'ABCD',
    })
  })

  it('should refresh the captcha after a failed login that carried one', async () => {
    await mountPage('/login')
    vi.mocked(loginAccount).mockRejectedValueOnce(
      new MockApiError(
        'CAPTCHA_REQUIRED',
        '登录失败次数较多，请输入图形验证码后重试',
        400,
        'captchaCode',
      ),
    )

    await fillLogin({ password: 'wrong2026' })
    await submit()
    expect(fetchCaptcha).toHaveBeenCalledTimes(1)

    // 验证码一次性：带着它登录仍然失败时，旧图已经作废
    vi.mocked(loginAccount).mockRejectedValueOnce(
      new MockApiError('AUTH_INVALID_CREDENTIALS', '用户名或密码不正确', 401, 'password'),
    )
    await wrapper.get('input[name="captchaCode"]').setValue('ABCD')
    await submit()
    await nextTick()

    expect(fetchCaptcha).toHaveBeenCalledTimes(2)
    expect(wrapper.get('input[name="captchaCode"]').element.value).toBe('')
    expect(wrapper.text()).toContain('用户名或密码不正确')
  })

  it('should show AUTH_INVALID_CREDENTIALS on the password field', async () => {
    await mountPage('/login')
    vi.mocked(loginAccount).mockRejectedValue(
      new MockApiError('AUTH_INVALID_CREDENTIALS', '用户名或密码不正确', 401, 'password'),
    )

    await fillLogin({ password: 'wrong2026' })
    await submit()

    expect(wrapper.text()).toContain('用户名或密码不正确')
    expect(wrapper.find('input[name="captchaCode"]').exists()).toBe(false)
    expect(wrapper.find('.field-error').exists()).toBe(true)
  })

  it('should validate the register form locally', async () => {
    await mountPage('/register')
    await fillRegister({ username: 'ab', password: 'abcdefgh', confirmPassword: 'abcdefgh' })
    await submit()

    expect(wrapper.text()).toContain('用户名至少 3 个字符')
    expect(wrapper.text()).toContain('密码需要包含数字')
    expect(registerAccount).not.toHaveBeenCalled()
  })

  it('should stop a mismatched confirmation before calling the api', async () => {
    await mountPage('/register')
    await fillRegister({ confirmPassword: 'read2027' })
    await submit()

    expect(wrapper.text()).toContain('两次输入的密码不一致')
    expect(registerAccount).not.toHaveBeenCalled()
  })

  it('should register, persist the session and land on the redirect target', async () => {
    await mountPage('/register?redirect=/profile')
    vi.mocked(registerAccount).mockResolvedValue({
      token: 'token-reg',
      expiresAt: '2026-10-30T00:00:00.000Z',
      user: { id: 'u_1', username: 'reader_01', nickname: 'reader_01' },
    })

    await fillRegister()
    await submit()

    expect(registerAccount).toHaveBeenCalledWith({
      username: 'reader_01',
      phone: undefined,
      captchaId: CAPTCHA.captchaId,
      captchaCode: 'ABCD',
      password: 'read2026',
    })
    expect(localStore.get(storageKeys.accessToken)).toBe('token-reg')
    expect(router.currentRoute.value.fullPath).toBe('/profile')
  })

  it('should refresh the captcha after a wrong answer and keep the code empty', async () => {
    await mountPage('/register')
    vi.mocked(registerAccount).mockRejectedValue(
      new MockApiError('CAPTCHA_INVALID', '验证码不对，请重新输入', 400, 'captchaCode'),
    )

    await fillRegister({ captchaCode: '0000' })
    await submit()
    await nextTick()

    expect(fetchCaptcha).toHaveBeenCalledTimes(2)
    expect(wrapper.get('input[name="captchaCode"]').element.value).toBe('')
    expect(wrapper.text()).toContain('验证码不对')
  })
})

describe('auth page · skip browsing', () => {
  it('should offer a skip link on both tabs', async () => {
    await mountPage('/login')
    expect(wrapper.get('.auth-skip').text()).toContain('先逛逛')
    expect(wrapper.get('.auth-skip').attributes('href')).toBe('/')

    await mountPage('/register')
    expect(wrapper.get('.auth-skip').attributes('href')).toBe('/')
  })

  it('should skip back to the page the guest came from', async () => {
    await mountPage('/login?redirect=/profile')

    expect(wrapper.get('.auth-skip').attributes('href')).toBe('/profile')

    await wrapper.get('.auth-skip').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('profile')
  })

  it('should send a reading redirect home instead of a gated page', async () => {
    // 阅读页对游客是整页登录引导，回跳它等于原地打转（md/45 §5.9）
    await mountPage('/login?redirect=/readings/r5')

    expect(wrapper.get('.auth-skip').attributes('href')).toBe('/')
  })
})
