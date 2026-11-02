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
 * 429 QUOTA_EXCEEDED 的文案（md/35 §7.2 / §9 第 3 条、md/43 §12）
 *
 * 与 RATE_LIMITED 分开：限流是「等一分钟」，额度是「等明天」，按钮也不同。
 * scope 说明哪一档先用尽——换账号或换浏览器都绕不过剩下的那档。
 *
 * 这是「免费生成次数」而不是「账号最多只能生成 N 次」：接入自备 API Key 的用户
 * 花自己的额度，不占免费次数。所以正文必须说清「免费」，并给出继续生成的出口。
 *
 * @param {{ details?: { scope?: string, limit?: number, used?: number, resetAt?: string } }} error
 * @returns {{ scope: string, title: string, hint: string }}
 */
export function describeQuotaExceeded({ details = {} } = {}) {
  const scope = details.scope || 'device'
  const label = QUOTA_SCOPE_LABELS[scope] || '设备'
  const limit = toNumber(details.limit)
  const reset = resetPhraseOf(details.resetAt)
  const ownKeyHint = '接入自己的 API Key 后可不占用免费次数继续生成。'

  return {
    scope,
    title: '今天的免费生成次数用完了',
    hint:
      limit !== null
        ? `${label}每天最多免费生成 ${limit} 次，${reset}重置。${ownKeyHint}`
        : `${label}今天的免费次数已经用完，${reset}重置。${ownKeyHint}`,
  }
}

/**
 * 503 FREE_BUDGET_EXHAUSTED 的文案（md/36 §6.2 / §10）
 *
 * 与 QUOTA_EXCEEDED 的区别：每日额度会「明天 0 点」恢复，免费池不会——
 * 后端既不给 resetAt 也不给 Retry-After，用户能做的只有接入自己的 API Key。
 * 所以这里不编恢复时间、不给等待建议；正文直接透传后端 message（§10 第 ②③ 条）。
 *
 * @returns {{ title: string }}
 */
export function describeFreeBudgetExhausted() {
  return { title: '免费生成额度用完了' }
}

/**
 * 自备 API Key 在生成时失效（md/43 §9）
 *
 * 两种情况用户做的事一样——去个人中心把 Key 换掉，但原因不同：
 *   USER_API_KEY_INVALID —— 上游拒绝了这把 Key（403，不是登录过期）
 *   USER_API_KEY_MISSING —— 建任务时用了 Key，执行前被删掉了（任务 failed，409）
 * 两者都不该给「重试」：Key 不变，重试必然再失败一次。也不要把人踢回登录页。
 *
 * @param {{ code?: string }} error
 * @returns {{ kind: string, title: string, hint: string }}
 */
export function describeUserApiKeyProblem({ code = '' } = {}) {
  if (code === 'USER_API_KEY_MISSING') {
    return {
      kind: 'missing',
      title: '这次用的 API Key 已经不在了',
      hint: '在个人中心重新导入 API Key，再回到设置页生成一次。',
    }
  }

  return {
    kind: 'invalid',
    title: '你的 API Key 被拒绝了',
    hint: '这不是账号问题；请到个人中心替换这把 Key，再回来生成。',
  }
}

/**
 * 缺口大到「补词」不现实时的分界（md/57 §8.2）。
 * 篇幅门槛改成 3 倍已知词后，600 词要 1800 个认识词，缺口动辄上千；
 * 让用户为这一篇去背 1000 个词没有可操作性，超过这条线就先把「缩短篇幅」放主位。
 */
const SHORTEN_FIRST_SHORTAGE = 500

/**
 * 五种「生成被挡下」的语义不同，用户能做的补救也不同：
 *   too_few_words    —— 422 个人词库不足 20 词的总闸：加词 / 先写 100–200 词
 *   target_words     —— 422 这次参数凑不齐目标词：缩篇幅 / 换词源
 *   known_words      —— 422 这个难度还没解锁：加词 / 降难度
 *   target_words_cap —— 400 这个难度写不了这么长（不是词不够）：只能缩篇幅
 *   final_mode_locked—— 400 601–1000 属最终模式，个人词库还没攒够：加词 / 缩篇幅
 *
 * 各处的 details 形状见 src/shared/errors.js 的
 * vocabularyTooSmall / knownWordsBelowLength / targetWordsTooLong / finalModeLocked。
 *
 * @returns {{ kind: string, title: string, hint: string, actions: string[], primaryAction: string }}
 *   primaryAction —— 覆盖层用来决定哪个按钮是主按钮；必须出现在 actions 里
 */
export function describeVocabShortage({ code = '', details = {} } = {}) {
  // 20 词总闸（md/39）：这条错误没有 details，不能按 known_words 解释。
  // 0 词用户除了「加词」，还能直接写 100 / 200 词的冷启动短篇（只用基础词表）；
  // 「降低难度」对他们是无效建议——任何难度都要过这道 20 词的门。
  if (code === 'INSUFFICIENT_VOCABULARY') {
    return {
      kind: 'too_few_words',
      title: '词汇太少，暂时写不了这篇文章',
      hint: '可以先添加一些单词；个人词库不足 20 个时，也可以先写 100 / 200 词的短篇。',
      actions: ['shorten', 'add'],
      primaryAction: 'add',
    }
  }

  const kind = details.kind || 'target_words'
  const required = toNumber(details.required)
  const available = toNumber(details.available)
  const shortage = toNumber(details.shortage) ?? Math.max(0, (required ?? 0) - (available ?? 0))
  // 3N 门槛下缺口可能远超用户能补的量，这时缩短篇幅才是当下走得通的路
  const shortenFirst = shortage > SHORTEN_FIRST_SHORTAGE

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
      primaryAction: missing > SHORTEN_FIRST_SHORTAGE ? 'shorten' : 'add',
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
      primaryAction: 'shorten',
    }
  }

  if (kind === 'known_words') {
    return {
      kind,
      title: '这个难度的词汇量还不够',
      hint:
        shortage > 0
          ? shortenFirst
            ? `这个篇幅要认识约 ${required ?? '当前门槛'} 个单词，还差 ${shortage} 个；先缩短篇幅最快。`
            : `还需要认识 ${shortage} 个单词（个人词库 + 基础词表）。`
          : '可以先添加一些单词，或降低难度再试。',
      // 缺口大时「补词」没有可操作性，先把缩短篇幅摆到前面
      actions: shortenFirst ? ['shorten', 'lower', 'add'] : ['lower', 'add'],
      primaryAction: shortenFirst ? 'shorten' : 'add',
    }
  }

  // 具体词源（今天新学 / 今天复习过）池子为空时，「加词 / 缩短」都不解决问题：
  // 加词只进「今天新学」，缩短到 100 词仍然为空。直接说明缺的是哪类词，
  // 并给一个真能走下去的入口（去复习 / 去加词）
  const scope = Array.isArray(details.scope) ? details.scope : []
  const emptyScopedPool =
    available === 0 && !details.selectedCount && scope.length > 0 && !scope.includes('all')

  if (emptyScopedPool) {
    const hasReviewed = scope.includes('today_reviewed')
    const hasNew = scope.includes('today_new')
    const actions = [...(hasReviewed ? ['review'] : []), ...(hasNew ? ['add'] : [])]

    return {
      kind,
      title: '今天的词源还没有可用词',
      hint:
        hasReviewed && hasNew
          ? '今天还没有新学或复习的词，这两个词源暂时没有可用词。先学或复习几篇，或把词源改成「全部词汇」。'
          : hasReviewed
            ? '今天还没有复习记录，「今天复习过」这个词源暂时没有可用词。先完成今天的复习，或把词源改成「全部词汇」。'
            : '今天还没有新学的词，「今天新学」这个词源暂时没有可用词。先添加单词，或把词源改成「全部词汇」。',
      actions: actions.length ? actions : ['add'],
      primaryAction: actions[0] || 'add',
    }
  }

  return {
    kind,
    title: '这次的文章篇幅凑不齐目标词',
    hint:
      shortage > 0
        ? shortenFirst
          ? `按当前词库，这个篇幅还差 ${shortage} 个可用词；先缩短篇幅最快。`
          : `按当前词库，这个篇幅还差 ${shortage} 个可用词。`
        : '可以缩短篇幅、换一个词源，或先添加一些单词。',
    actions: ['shorten', 'lower', 'add'],
    primaryAction: shortenFirst ? 'shorten' : 'add',
  }
}

/**
 * 生成被闸门挡下（后端 md/55 §8）：三种都是临时拥塞，等几秒就能再试，
 * 但「谁在等」和「要不要从头来」不同，文案分开写。
 *
 *   GENERATION_SATURATED —— 调度器队满，503。任务根本没建、额度没扣；
 *                           冷却期内连点只会继续撞队，所以要按住 retryAfter。
 *   AI_PROVIDER_BUSY     —— 上游熔断或信号量等超时，503。可重试，已写好的段会保留。
 *   GENERATION_TIMEOUT   —— 整篇 deadline 到，504 / 任务 failed。额度后端已退回。
 *
 * 三个码都不带「你哪里做错了」的含义，别引导用户改设置。
 */

/**
 * 503 GENERATION_SATURATED
 * @param {{ details?: { retryAfter?: number } }} error
 * @returns {{ title: string, hint: string }}
 */
export function describeGenerationSaturated({ details = {} } = {}) {
  const retryAfter = toNumber(details.retryAfter) ?? toNumber(details.remainingSeconds) ?? 5

  return {
    title: '当前生成人数较多',
    hint: `同时生成的人有点多，请 ${retryAfter} 秒后再试。这次没有开始生成，也不占用今天的免费次数。`,
  }
}

/**
 * 503 AI_PROVIDER_BUSY
 * @param {{ details?: { retryAfter?: number } }} error
 * @returns {{ title: string, hint: string }}
 */
export function describeProviderBusy({ details = {} } = {}) {
  const retryAfter = toNumber(details.retryAfter) ?? toNumber(details.remainingSeconds) ?? 10

  return {
    title: 'AI 服务暂时繁忙',
    hint: `上游模型这会儿有点忙，请 ${retryAfter} 秒后再试。可以直接重试，已经写好的部分会保留。`,
  }
}

/**
 * 504 / 任务 failed GENERATION_TIMEOUT
 * deadlineMs 是整篇的时间预算，写进文案让用户知道「不是你等得不够久」
 * @param {{ details?: { deadlineMs?: number } }} error
 * @returns {{ title: string, hint: string }}
 */
export function describeGenerationTimeout({ details = {} } = {}) {
  const deadlineMs = toNumber(details.deadlineMs)
  const seconds = deadlineMs && deadlineMs > 0 ? Math.round(deadlineMs / 1000) : null
  const budget = seconds ? `一篇最多写 ${seconds} 秒` : '一篇长文最多只能跑一小段时间'

  return {
    title: '这次生成超时了',
    hint: `${budget}，这次没跑完。已经扣掉的免费次数会自动退回，可以直接重新生成。`,
  }
}

/**
 * 自选单词不可用（422 FOCUS_WORDS_NOT_LEARNED，md/54 §3.2）
 *
 * 后端在调用模型**之前**就拒绝，不占额度；重试同样的词必然再失败一次，
 * 所以调用方要把它当不可重试错误，出口只有「回去改选」。
 *
 * @param {{ details?: { words?: string[], count?: number } }} error
 * @returns {{ title: string, hint: string }}
 */
export function describeFocusWords({ details = {} } = {}) {
  const words = Array.isArray(details.words) ? details.words.filter(Boolean) : []
  const count = toNumber(details.count) ?? words.length
  const shown = words.slice(0, 5).join('、')

  return {
    title: '你选的单词里有失效的',
    hint: words.length
      ? `这 ${count} 个词不在词库，或已被标记为「不认识」：${shown}${
          count > words.slice(0, 5).length ? ' 等' : ''
        }。回到设置页把它们移除，或改选别的词。`
      : '有单词不在你的词库或已被标记为「不认识」，回到设置页改选后再生成。',
  }
}
