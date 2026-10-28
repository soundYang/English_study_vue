/**
 * 鉴权接口测试
 * 覆盖验证码形状与一次性、注册校验与重名、登录失败累计触发验证码、
 * 会话落盘与退出；使用真实 mock adapter（延迟 0），不触碰网络。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { fetchCaptcha, loginAccount, logoutAccount, registerAccount } from '../auth'
import { MOCK_DEMO_CREDENTIALS, mockAuth, resetMockDb, setMockLatency } from '../../mock/adapter'

/** 取一张验证码，并借 mock 的调试口拿到答案（真实后端不会返回答案） */
async function takeCaptcha() {
  const data = await fetchCaptcha()
  return {
    captchaId: data.captchaId,
    captchaCode: mockAuth.peekCaptchaCode(data.captchaId),
  }
}

async function registerUser(overrides = {}) {
  const captcha = await takeCaptcha()
  return registerAccount({
    username: 'reader_01',
    password: 'read2026',
    phone: '',
    ...captcha,
    ...overrides,
  })
}

beforeEach(() => {
  localStorage.clear()
  resetMockDb()
  setMockLatency(0)
})

describe('auth api', () => {
  it('should return a captcha with an inline svg and a 5 minute ttl', async () => {
    const data = await fetchCaptcha()

    expect(data.captchaId).toMatch(/^mock_/)
    expect(data.svg.startsWith('<svg')).toBe(true)
    expect(data.svg).toContain('<text')
    expect(data.expiresIn).toBe(300)
  })

  it('should register and sign in immediately with a safe user payload', async () => {
    const data = await registerUser({ phone: '13800138000' })

    expect(data.token).toBeTruthy()
    expect(data.expiresAt).toBeTruthy()
    expect(data.user).toMatchObject({
      username: 'reader_01',
      nickname: 'reader_01',
      phone: '13800138000',
    })
    // 白名单：密码与内部字段不出现在响应里
    expect(data.user.password).toBeUndefined()
    expect(data.user.passwordHash).toBeUndefined()
    expect(data.user.usernameLower).toBeUndefined()
    expect(mockAuth.currentUser()?.username).toBe('reader_01')
  })

  it('should consume the captcha even when the answer is wrong', async () => {
    const captcha = await takeCaptcha()

    await expect(
      registerAccount({
        username: 'reader_02',
        password: 'read2026',
        ...captcha,
        captchaCode: '0000',
      }),
    ).rejects.toMatchObject({ error: { code: 'CAPTCHA_INVALID', field: 'captchaCode' } })

    // 一次性：同一张验证码再答对也已经作废（md/33 §5.3）
    await expect(
      registerAccount({ username: 'reader_02', password: 'read2026', ...captcha }),
    ).rejects.toMatchObject({ error: { code: 'CAPTCHA_EXPIRED' } })
  })

  it('should reject a taken username and an invalid password', async () => {
    await registerUser()

    await expect(registerUser({ username: 'READER_01' })).rejects.toMatchObject({
      error: { code: 'AUTH_USERNAME_TAKEN', field: 'username' },
    })

    await expect(
      registerUser({ username: 'reader_03', password: 'abcdefgh' }),
    ).rejects.toMatchObject({ error: { field: 'password' } })
    await expect(
      registerUser({ username: 'reader_03', password: '12345678' }),
    ).rejects.toMatchObject({ error: { field: 'password' } })
    await expect(registerUser({ username: 'ab', password: 'read2026' })).rejects.toMatchObject({
      error: { field: 'username' },
    })
    await expect(
      registerUser({ username: 'reader_03', phone: '12345', password: 'read2026' }),
    ).rejects.toMatchObject({ error: { field: 'phone' } })
  })

  it('should log in the demo account and reject a wrong password', async () => {
    const data = await loginAccount({
      usernameOrPhone: MOCK_DEMO_CREDENTIALS.username,
      password: MOCK_DEMO_CREDENTIALS.password,
    })

    expect(data.user.username).toBe(MOCK_DEMO_CREDENTIALS.username)
    expect(data.token).toBeTruthy()

    await expect(
      loginAccount({ usernameOrPhone: MOCK_DEMO_CREDENTIALS.username, password: 'wrong2026' }),
    ).rejects.toMatchObject({
      error: { code: 'AUTH_INVALID_CREDENTIALS', field: 'password' },
    })
  })

  it('should require a captcha after five failures and then log in', async () => {
    const payload = { usernameOrPhone: 'Sound', password: 'wrong2026' }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(loginAccount(payload)).rejects.toMatchObject({
        error: { code: 'AUTH_INVALID_CREDENTIALS' },
      })
    }

    await expect(loginAccount(payload)).rejects.toMatchObject({
      error: { code: 'CAPTCHA_REQUIRED', field: 'captchaCode' },
    })

    const captcha = await takeCaptcha()
    const data = await loginAccount({
      usernameOrPhone: MOCK_DEMO_CREDENTIALS.username,
      password: MOCK_DEMO_CREDENTIALS.password,
      ...captcha,
    })

    expect(data.user.username).toBe(MOCK_DEMO_CREDENTIALS.username)
    // 登录成功后失败计数清零，再错一次也不会立刻要验证码
    await expect(loginAccount(payload)).rejects.toMatchObject({
      error: { code: 'AUTH_INVALID_CREDENTIALS' },
    })
  })

  it('should clear the mock session on logout', async () => {
    await loginAccount({
      usernameOrPhone: MOCK_DEMO_CREDENTIALS.username,
      password: MOCK_DEMO_CREDENTIALS.password,
    })
    expect(mockAuth.currentUser()).not.toBeNull()

    await expect(logoutAccount()).resolves.toEqual({ ok: true })
    expect(mockAuth.currentUser()).toBeNull()
  })
})
