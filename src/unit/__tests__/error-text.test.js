/**
 * 错误文案映射测试
 * describeVocabShortage 返回的 actions 是覆盖层按钮的唯一真相，
 * 改这里等于改用户能点的东西，所以三种 kind 各锁一条。
 */
import { describe, expect, it } from 'vitest'
import {
  describeFreeBudgetExhausted,
  describeQuotaExceeded,
  describeRateLimit,
  describeUserApiKeyProblem,
  describeVocabShortage,
} from '../error-text'

describe('describeVocabShortage', () => {
  // 20 词总闸（md/39）：0 词用户请求 300 词时也要给两条出路，
  // 不能按 known_words 说「降低难度」，更不能出现「600 词」这种具体门槛
  it('should offer the cold-start short piece at the 20-word gate', () => {
    const result = describeVocabShortage({ code: 'INSUFFICIENT_VOCABULARY', details: {} })

    expect(result.kind).toBe('too_few_words')
    expect(result.hint).toContain('100 / 200')
    expect(result.hint).not.toContain('600')
    expect(result.actions).toEqual(['shorten', 'add'])
  })

  it('should explain known-words shortage with the gap', () => {
    // 形状与后端 knownWordsTooSmall 的 details 一致：required / available / shortage
    const result = describeVocabShortage({
      code: 'VOCABULARY_TOO_SMALL',
      details: {
        kind: 'known_words',
        level: 'medium',
        required: 1900,
        available: 1758,
        shortage: 142,
      },
    })

    expect(result.actions).toEqual(['lower', 'add'])
    expect(result.hint).toContain('142')
  })

  it('should explain a target-words shortage with three ways out', () => {
    const result = describeVocabShortage({
      code: 'VOCABULARY_TOO_SMALL',
      details: { kind: 'target_words', required: 30, available: 20, targetWords: 200 },
    })

    expect(result.actions).toEqual(['shorten', 'lower', 'add'])
    expect(result.hint).toContain('10')
  })

  it('should only offer shortening when the level caps the length', () => {
    // 400 INVALID_REQUEST + target_words_cap：不是词不够，是难度上限
    const result = describeVocabShortage({
      code: 'INVALID_REQUEST',
      details: { kind: 'target_words_cap', level: 'easy', targetWords: 600, maxTargetWords: 300 },
    })

    expect(result.actions).toEqual(['shorten'])
    expect(result.hint).toContain('300')
  })

  // 20 词兜底没有 details：不再按 known_words 兜底，也不再建议降低难度（md/39）
  it('should not fall back to the known-words hint for the 20-word gate', () => {
    const result = describeVocabShortage({ code: 'INSUFFICIENT_VOCABULARY', details: {} })

    expect(result.kind).toBe('too_few_words')
    expect(result.actions).not.toContain('lower')
  })
})

describe('describeRateLimit', () => {
  it('should say how many requests per window are allowed', () => {
    const result = describeRateLimit({ details: { limit: 20, windowSeconds: 60 } })

    expect(result.title).toBe('生成太频繁了')
    expect(result.hint).toBe('每分钟最多生成 20 次，等一会儿再试。')
  })

  it('should read a non-minute window in seconds', () => {
    const result = describeRateLimit({ details: { limit: 5, windowSeconds: 30 } })

    expect(result.hint).toContain('每 30 秒最多生成 5 次')
  })

  // 剩余时间来自拦截器解析的 RateLimit: reset=N，不是窗口长度
  it('should quote the real remaining seconds when they are known', () => {
    const result = describeRateLimit({
      details: { limit: 20, windowSeconds: 60, remainingSeconds: 42 },
    })

    expect(result.hint).toBe('每分钟最多生成 20 次，请在 42 秒后再试。')
  })

  it('should not invent a countdown from the window length', () => {
    const result = describeRateLimit({ details: { limit: 20, windowSeconds: 60 } })

    expect(result.hint).toBe('每分钟最多生成 20 次，等一会儿再试。')
  })

  // 窗口长度不是剩余时间：没有 details 时只能说「等一会儿」，不能编一个倒计时
  it('should fall back to a generic hint without details', () => {
    const result = describeRateLimit({})

    expect(result.hint).toContain('等一会儿再试')
    expect(result.hint).not.toContain('分钟')
  })
})

describe('describeQuotaExceeded', () => {
  const resetAt = '2026-10-29T16:00:00.000Z'

  it('should name the exhausted scope and the Beijing reset time', () => {
    const result = describeQuotaExceeded({
      details: { scope: 'device', limit: 3, used: 3, resetAt },
    })

    // 这是「免费次数」用完，不是账号生成上限：接入自备 Key 还能继续生成
    expect(result.title).toBe('今天的免费生成次数用完了')
    expect(result.hint).toBe(
      '设备每天最多免费生成 3 次，10月30日 00:00（北京时间）重置。接入自己的 API Key 后可不占用免费次数继续生成。',
    )
  })

  // 三档额度文案必须能区分开：用户要知道是换账号有用，还是整个网络都被限了
  it('should word the account and network scopes differently', () => {
    expect(
      describeQuotaExceeded({ details: { scope: 'account', limit: 3, resetAt } }).hint,
    ).toContain('账号每天最多免费生成 3 次')
    expect(
      describeQuotaExceeded({ details: { scope: 'network', limit: 10, resetAt } }).hint,
    ).toContain('网络每天最多免费生成 10 次')
  })

  // 提示必须给出继续生成的出口，否则用户会以为「今天不能再生成」
  it('should point to the own API key as the way to keep generating', () => {
    const result = describeQuotaExceeded({ details: { scope: 'account', limit: 3, resetAt } })

    expect(result.hint).toContain('接入自己的 API Key')
    expect(result.hint).toContain('继续生成')
  })

  // resetAt 缺失或被改坏时不能显示 NaN / Invalid Date
  it('should fall back to tomorrow midnight without a usable resetAt', () => {
    const result = describeQuotaExceeded({ details: { scope: 'network', resetAt: 'oops' } })

    expect(result.hint).toContain('明天 00:00')
    expect(result.hint).not.toContain('Invalid')
  })
})

describe('describeFreeBudgetExhausted', () => {
  // 免费池不会自己恢复：文案里不能出现「明天」「稍后」这类暗示等待的说法（md/36 §10）
  it('should not promise a recovery time', () => {
    const result = describeFreeBudgetExhausted()

    expect(result.title).toBe('免费生成额度用完了')
    expect(result.title).not.toContain('明天')
    expect(result.title).not.toContain('稍后')
  })
})

describe('describeUserApiKeyProblem', () => {
  // 不是登录过期：不要把用户往登录页引（md/43 §9）
  it('should point an invalid key at the profile page, not the login page', () => {
    const result = describeUserApiKeyProblem({ code: 'USER_API_KEY_INVALID' })

    expect(result.kind).toBe('invalid')
    expect(result.hint).toContain('个人中心')
    expect(result.hint).not.toContain('登录')
  })

  it('should explain the missing key as a deleted key, not an invalid one', () => {
    const result = describeUserApiKeyProblem({ code: 'USER_API_KEY_MISSING' })

    expect(result.kind).toBe('missing')
    expect(result.title).toContain('已经不在了')
    expect(result.hint).toContain('重新导入')
  })
})
