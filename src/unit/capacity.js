/**
 * 预检门禁解读
 * /capacity 的 levels[level] 把三道门折算成几个数字（md/30 §7、md/22 §1）：
 *   篇幅上限 → 已知词门槛 → 候选池（A 门）
 * 生成接口按同样的顺序拦截，这里按同样的顺序给出缘由，
 * 让设置页说「写不了」和点下去得到的 422 指的是同一件事。
 */

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * 写当前篇幅还差多少个认识词。
 * 最终模式不查这道门（真实闸门是 personalWords），直接返回 0；
 * 字段缺失时也按 0 处理——宁可少说一句，也不要凭空编一个差额。
 */
export function knownShortageOf(gate) {
  if (!gate || gate.finalMode?.active) return 0

  const minKnown = toNumber(gate.minKnown)
  const knownWords = toNumber(gate.knownWords)

  if (minKnown === null || knownWords === null) return 0

  return Math.max(0, minKnown - knownWords)
}

/**
 * 当前参数被挡在哪一步；null 表示预检通过
 * kind 与后端的 blockedBy / details.kind 同名，前端不必再翻译一层：
 *   level_cap   这个难度到头了，只能缩短或换难度
 *   known_words 认识词不够写这么长，可以加词或缩短
 *   target_words 候选池凑不齐目标词，缩短 / 换词源 / 加词都有效
 */
export function blockReasonOf(gate) {
  if (!gate) return null
  // 最终模式已解锁：篇幅上限和已知词门槛都不再适用
  if (gate.finalMode?.active) return null

  if (gate.targetWordsAllowed === false) {
    return { kind: 'level_cap', maxTargetWords: toNumber(gate.maxTargetWords) }
  }

  const shortage = knownShortageOf(gate)

  if (shortage > 0) {
    return {
      kind: 'known_words',
      shortage,
      minKnown: toNumber(gate.minKnown),
      knownWords: toNumber(gate.knownWords),
    }
  }

  if (gate.sufficient === false) {
    return { kind: 'target_words', shortage: toNumber(gate.shortage) ?? 0 }
  }

  return null
}

/**
 * 词汇量进度条（md/22 §7）：分子分母全部取 `/capacity` 的值，前端不自己算 618 / 3000 / minKnown。
 *
 * 三种口径：
 *   - 最终模式生效（hard 且篇幅 > 600 且已解锁）：personalWords / finalMode.unlockAt；
 *   - 请求了 601+ 但还没解锁：同样看 personalWords / unlockAt——这时卡住的是解锁，
 *     不是 `minKnown`（后者是 3618 的折算值，显示出来只会让人去背无关的已知词）；
 *   - 其余篇幅：knownWords / minKnown。
 *
 * 门槛为 0（最终模式生效 / 冷启动）或字段缺失时返回 null：宁可不画，也不编一个分母。
 *
 * @returns {{ label: string, current: number, target: number, percent: number, met: boolean } | null}
 */
export function vocabMeterOf(gate, finalMode = null) {
  if (!gate) return null

  // 601–1000 的两种状态都按个人词库口径；其余按已知词口径
  const byPersonalWords =
    Boolean(gate.finalMode?.active) ||
    Boolean(
      gate.finalMode?.supported &&
      gate.finalMode?.unlocked === false &&
      gate.targetWordsAllowed === false,
    )

  const current = byPersonalWords ? toNumber(gate.personalWords) : toNumber(gate.knownWords)
  const target = byPersonalWords ? toNumber(finalMode?.unlockAt) : toNumber(gate.minKnown)

  if (current === null || target === null || target <= 0) return null

  return {
    label: byPersonalWords ? '个人词库' : '已知词',
    current,
    target,
    percent: Math.min(100, Math.round((current / target) * 100)),
    met: current >= target,
  }
}

/**
 * 词源池为空时的说明。
 *
 * 只对「今天新学 / 今天复习」这类具体词源成立：'all' 不会为空。
 * 此时常规的「加词 / 缩短」建议都不成立——加词只会进「今天新学」，
 * 缩短已经到 100 词仍为空，降难度也不会让池子变大。必须直接说明原因。
 */
function emptyScopeText(scope) {
  const list = Array.isArray(scope) ? scope : []
  if (list.includes('all') || list.length === 0) return ''

  const hasReviewed = list.includes('today_reviewed')
  const hasNew = list.includes('today_new')

  if (hasReviewed && hasNew) {
    return '今天还没有新学或复习的词，「今天新学」和「今天复习」这两个词源暂时没有可用词；先学或复习几篇，或把词源改成「全部词汇」。'
  }

  if (hasReviewed) {
    return '今天还没有复习记录，「今天复习」这个词源暂时没有可用词；先完成今天的复习，或把词源改成「全部词汇」。'
  }

  if (hasNew) {
    return '今天还没有新学的词，「今天新学」这个词源暂时没有可用词；先添加单词，或把词源改成「全部词汇」。'
  }

  return ''
}

/**
 * 设置页「当前参数能不能写」的一句话
 * @returns {{ tone: 'ok'|'warn', text: string } | null}
 */
export function capacityNoteOf(
  gate,
  { levelLabel = '当前难度', targetWords = 0, wordRangeLabel = '', scope = [] } = {},
) {
  const block = blockReasonOf(gate)

  if (!block) {
    const max = toNumber(gate?.maxTargetWords)
    if (max === null) return null

    return {
      tone: 'ok',
      text: `当前难度可写 ${max} 词以内${wordRangeLabel ? `，成文约 ${wordRangeLabel}` : ''}。`,
    }
  }

  if (block.kind === 'level_cap') {
    return {
      tone: 'warn',
      text:
        block.maxTargetWords === null
          ? `${levelLabel}写不了这么长，可以缩短篇幅或换更高难度。`
          : `${levelLabel}最多写 ${block.maxTargetWords} 词，可以缩短篇幅或换更高难度。`,
    }
  }

  if (block.kind === 'known_words') {
    return {
      tone: 'warn',
      text: `${levelLabel}写 ${targetWords} 词需要认识约 ${block.minKnown} 个单词，当前 ${block.knownWords} 个，还差 ${block.shortage} 个。`,
    }
  }

  // A 门先区分「池子为空」与「池子不够」：空池时告诉用户缺的是哪类词，
  // 而不是让他去缩短一篇已经最短的文章
  const emptyText = toNumber(gate?.available) === 0 ? emptyScopeText(scope) : ''
  if (emptyText) return { tone: 'warn', text: emptyText }

  return { tone: 'warn', text: `这个篇幅还差 ${block.shortage} 个可用词，建议缩短文章。` }
}

/**
 * 难度卡下面的一行缘由；空串表示这一档没有可说的
 * A 门不在这里重复：三张卡会同时出现同一句话，交给设置页的整句说明。
 */
export function difficultyNoteOf(gate) {
  const block = blockReasonOf(gate)

  if (!block) return ''
  if (block.kind === 'known_words') return `还差 ${block.shortage} 个认识词`
  if (block.kind === 'level_cap') {
    return block.maxTargetWords === null
      ? '这个难度写不了这么长'
      : `最多写 ${block.maxTargetWords} 词`
  }

  return ''
}

/**
 * 最终模式的解锁说明
 * supported=false（easy / medium）返回空串，不在页面占位置。
 * 这里用的是**个人词库**口径（finalMode.shortage），与 lengths[].shortage
 * （已知词口径）不是同一个数，不能合并成一句「还差 N 个词」（后端 md/22 §7）。
 */
export function finalModeNoteOf(finalMode) {
  if (!finalMode?.supported) return ''

  if (finalMode.unlocked) return '已解锁最终模式：可以写 601–1000 词。'

  const unlockAt = toNumber(finalMode.unlockAt) ?? 3000
  const shortage = Math.max(0, toNumber(finalMode.shortage) ?? 0)

  return shortage > 0
    ? `601–1000 词属最终模式，需个人词库 ${unlockAt} 个单词（还差 ${shortage} 个）。`
    : `601–1000 词属最终模式，需个人词库 ${unlockAt} 个单词。`
}
