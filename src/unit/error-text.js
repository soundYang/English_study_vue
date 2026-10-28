/**
 * 业务错误的可读文案
 * 后端把结构化上下文放在 error.details（src/shared/errors.js），这里只做
 * details → 中文 + 动作清单的映射，不参与请求与状态管理，便于单测。
 */

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/** 窗口长度转成「每分钟 / 每 2 分钟 / 每 30 秒」 */
function windowPhraseOf(seconds) {
  if (!seconds) return ''
  if (seconds === 60) return '每分钟'
  if (seconds > 60 && seconds % 60 === 0) return `每 ${seconds / 60} 分钟`

  return `每 ${seconds} 秒`
}

/**
 * 429 RATE_LIMITED 的文案（后端 md/22 §4 / §8.5 ③）
 *
 * details.windowSeconds 是**窗口长度**，不是剩余时间——不能拿它写「1 分钟后重试」，
 * 因为用户可能刚刚开始这个窗口。剩余时间只认请求拦截器从 `RateLimit: … reset=N`
 * 解析出来的 details.remainingSeconds；没有就只说「等一会儿」，不编倒计时。
 *
 * @param {{ details?: { limit?: number, windowSeconds?: number, remainingSeconds?: number } }} error
 * @returns {{ title: string, hint: string }}
 */
export function describeRateLimit({ details = {} } = {}) {
  const limit = toNumber(details.limit)
  const windowPhrase = windowPhraseOf(toNumber(details.windowSeconds))
  const remaining = toNumber(details.remainingSeconds)
  const waitPhrase = remaining > 0 ? `请在 ${remaining} 秒后再试。` : '等一会儿再试。'

  return {
    title: '生成太频繁了',
    hint:
      limit !== null && windowPhrase
        ? `${windowPhrase}最多生成 ${limit} 次，${waitPhrase}`
        : `请求太频繁了，${waitPhrase}`,
  }
}

const QUOTA_SCOPE_LABELS = { account: '账号', device: '设备', network: '网络' }

// 额度的重置点由后端算好（北京时间次日 0 点），这里只负责按同一时区展示，
// 不依赖用户本机时区——否则出国后会看到「明天 15:00 重置」这种怪话
const resetFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function resetPhraseOf(resetAt) {
  const date = new Date(resetAt)
  if (Number.isNaN(date.getTime())) return '明天 00:00'

  return `${resetFormatter.format(date)}（北京时间）`
}

/**
 * 429 QUOTA_EXCEEDED 的文案（md/35 §7.2 / §9 第 3 条）
 *
 * 与 RATE_LIMITED 分开：限流是「等一分钟」，额度是「等明天」，按钮也不同。
 * scope 说明哪一档先用尽——换账号或换浏览器都绕不过剩下的那档。
 *
 * @param {{ details?: { scope?: string, limit?: number, used?: number, resetAt?: string } }} error
 * @returns {{ scope: string, title: string, hint: string }}
 */
export function describeQuotaExceeded({ details = {} } = {}) {
  const scope = details.scope || 'device'
  const label = QUOTA_SCOPE_LABELS[scope] || '设备'
  const limit = toNumber(details.limit)
  const reset = resetPhraseOf(details.resetAt)

  return {
    scope,
    title: '今天的生成次数用完了',
    hint:
      limit !== null
        ? `${label}每天最多生成 ${limit} 次，${reset}重置。`
        : `${label}今天的次数已经用完，${reset}重置。`,
  }
}

/**
 * 四种「生成被挡下」的语义不同，用户能做的补救也不同：
 *   target_words     —— 422 这次参数凑不齐目标词：缩篇幅 / 换词源
 *   known_words      —— 422 这个难度还没解锁：加词 / 降难度
 *   target_words_cap —— 400 这个难度写不了这么长（不是词不够）：只能缩篇幅
 *   final_mode_locked—— 400 601–1000 属最终模式，个人词库还没攒够：加词 / 缩篇幅
 *
 * 各处的 details 形状见 src/shared/errors.js 的
 * vocabularyTooSmall / knownWordsBelowLength / targetWordsTooLong / finalModeLocked。
 *
 * @returns {{ kind: string, title: string, hint: string, actions: string[] }}
 */
export function describeVocabShortage({ code = '', details = {} } = {}) {
  const kind = details.kind || (code === 'INSUFFICIENT_VOCABULARY' ? 'known_words' : 'target_words')
  const required = toNumber(details.required)
  const available = toNumber(details.available)
  const shortage = toNumber(details.shortage) ?? Math.max(0, (required ?? 0) - (available ?? 0))

  if (kind === 'final_mode_locked') {
    const unlockAt = toNumber(details.unlockAt) ?? 3000
    const missing = Math.max(0, toNumber(details.shortage) ?? 0)

    return {
      kind,
      title: '还差一点就能写长文了',
      hint:
        missing > 0
          ? `601–1000 词属「最终模式」，个人词库满 ${unlockAt} 个单词才能解锁，还差 ${missing} 个。`
          : `601–1000 词属「最终模式」，需要个人词库 ${unlockAt} 个单词。`,
      // 加词是解锁的唯一路径；缩短篇幅是当下就能生成的办法
      actions: ['shorten', 'add'],
    }
  }

  if (kind === 'target_words_cap') {
    const maxTargetWords = toNumber(details.maxTargetWords)

    return {
      kind,
      title: '当前难度写不了这么长',
      hint:
        maxTargetWords === null
          ? '可以缩短篇幅，或提高难度后再试。'
          : `这个难度最多 ${maxTargetWords} 词，可以缩短篇幅或提高难度。`,
      // 只有缩篇幅有效：加词、降难度都改变不了这个上限
      actions: ['shorten'],
    }
  }

  if (kind === 'known_words') {
    return {
      kind,
      title: '这个难度的词汇量还不够',
      hint:
        shortage > 0
          ? `还需要认识 ${shortage} 个单词（个人词库 + 基础词表）。`
          : '可以先添加一些单词，或降低难度再试。',
      actions: ['lower', 'add'],
    }
  }

  return {
    kind,
    title: '这次的文章篇幅凑不齐目标词',
    hint:
      shortage > 0
        ? `按当前词库，这个篇幅还差 ${shortage} 个可用词。`
        : '可以缩短篇幅、换一个词源，或先添加一些单词。',
    actions: ['shorten', 'lower', 'add'],
  }
}
