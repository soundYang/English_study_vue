/**
 * 业务错误的可读文案
 * 后端把结构化上下文放在 error.details（src/shared/errors.js），这里只做
 * details → 中文 + 动作清单的映射，不参与请求与状态管理，便于单测。
 */

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * 三种「生成被挡下」的语义不同，用户能做的补救也不同：
 *   target_words     —— 422 这次参数凑不齐目标词：缩篇幅 / 换词源
 *   known_words      —— 422 这个难度还没解锁：加词 / 降难度
 *   target_words_cap —— 400 这个难度写不了这么长（不是词不够）：只能缩篇幅
 *
 * 三处的 details 形状见 src/shared/errors.js 的
 * vocabularyTooSmall / knownWordsTooSmall / targetWordsTooLong。
 *
 * @returns {{ kind: string, title: string, hint: string, actions: string[] }}
 */
export function describeVocabShortage({ code = '', details = {} } = {}) {
  const kind =
    details.kind || (code === 'INSUFFICIENT_VOCABULARY' ? 'known_words' : 'target_words')
  const required = toNumber(details.required)
  const available = toNumber(details.available)
  const shortage = toNumber(details.shortage) ?? Math.max(0, (required ?? 0) - (available ?? 0))

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
