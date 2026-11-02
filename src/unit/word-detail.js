/**
 * 单词详情（浮层）的展示数据
 * 基础词汇、我的单词、文章里的未学词共用一套结构：单词 + 音标 + 全部义项 + 若干「标签 / 值」事实行。
 * 数据全部来自接口快照，这里只做映射，不发请求（见 md/17 §2、md/18 §3）。
 */
import { meaningOf, statusOf } from './basic-words'
import { formatDate } from './format'
import { frequencyTierOf } from './word-tiers'

const KIND_LABELS = { basic: '基础词', calendar: '日历词', abbreviation: '缩写' }
const SOURCE_LABELS = { dictionary: '词库', manual: '手填', 'basic-removed': '从基础词表移除' }
// 文章 newWords 的 source 只有两种：词库词与缩写
const NEW_WORD_SOURCE_LABELS = { dictionary: '词库', abbreviation: '缩写' }

function kindsOf(item) {
  const labels = (item.kinds || []).map((kind) => KIND_LABELS[kind]).filter(Boolean)
  return labels.join(' · ') || '—'
}

/** 有排名才给这一行；手填词与源表缺失的词没有 COCA 名次 */
function cocaFact(rank) {
  const tier = frequencyTierOf(rank)
  return tier ? { label: '词频', value: `COCA ${rank} · ${tier.label}` } : null
}

function senseListOf(senses) {
  return (senses || [])
    .filter((sense) => sense?.meaning)
    .map((sense) => ({ pos: sense.pos || '', meaning: sense.meaning }))
}

/** 缩写的义项在 senses 里是空的，中文全称就是它唯一的一条「释义」 */
function basicSensesOf(item) {
  const senses = senseListOf(item.senses)
  if (senses.length) return senses
  if (item.expansionMeaning) return [{ pos: '', meaning: item.expansionMeaning }]

  const meaning = meaningOf(item)
  return meaning ? [{ pos: '', meaning }] : []
}

/** 基础词的标记说明：与菜单口径一致（md/52 §2.3 / §2.5） */
function basicMarkFact(item) {
  if (!item.removable) {
    return { label: '标记', value: item.isFunctionWord ? '功能词，不可标记' : '只读词，不可标记' }
  }

  if (item.personalState === 'removed') {
    return { label: '标记', value: '已标为不认识，可改回认识或取消' }
  }

  if (item.personalState === 'known') {
    return {
      label: '标记',
      value: item.knownSource === 'library' ? '已在词库中，去我的单词修改' : '已标为认识，可取消',
    }
  }

  return { label: '标记', value: '可标为认识或不认识' }
}

/** 基础词：状态、词表、词频、是否已进个人词库、可不可以标记，缩写补英文全称 */
export function basicWordDetail(item) {
  const status = statusOf(item)
  const facts = [
    { label: '状态', value: status.label },
    { label: '词表', value: kindsOf(item) },
  ]

  const coca = cocaFact(item.cocaRank)
  if (coca) facts.push(coca)

  if (item.personalStatus) {
    // 基础词页只拿得到 status，没有 studyState；learning 一律说「复习中」，
    // 与词库页的徽章保持同一套叫法（md/22 第 91 行）
    facts.push({
      label: '我的单词',
      value: item.personalStatus === 'mastered' ? '已掌握' : '复习中',
    })
  }

  facts.push(basicMarkFact(item))

  if (item.expansion) facts.push({ label: '英文全称', value: item.expansion })

  return {
    word: item.word,
    phonetic: item.phonetic,
    senses: basicSensesOf(item),
    facts,
  }
}

/**
 * 复习排期（md/56 P1）：轮次与下次复习日期
 *
 * `reviewStage` 是已通过的轮数；没复习过的词也显示「尚未复习」，
 * 而不是 0——0 看起来像故障。`mastered` 已退出队列，不能再显示「等待排期」。
 */
function reviewFacts(item) {
  const stage = Number(item.reviewStage) || 0
  const lapse = Number(item.lapseCount) || 0
  let round = stage > 0 ? `已通过 ${stage} 轮` : '尚未复习'
  if (lapse > 0) round += `，忘记 ${lapse} 次`

  return [
    { label: '复习轮次', value: round },
    {
      label: '下次复习',
      value:
        item.status === 'mastered'
          ? '已掌握，已退出复习队列'
          : formatDate(item.nextReviewAt) || '等待排期',
    },
  ]
}

/** 我的单词：来源、词频、收录时间、复习排期；义项直接用快照里的全部 senses */
export function myWordDetail(item) {
  const facts = [
    { label: '来源', value: SOURCE_LABELS[item.source] || '—' },
    { label: '收录', value: formatDate(item.createdAt) || '—' },
    ...reviewFacts(item),
  ]

  const coca = cocaFact(item.cocaRank)
  if (coca) facts.splice(1, 0, coca)

  return {
    word: item.word,
    phonetic: item.phonetic,
    senses: senseListOf(item.senses),
    facts,
  }
}

/** 文章里的未学词：只有一个来源标签（词库 / 缩写），释义是词表里的快照 */
export function newWordDetail(item) {
  return {
    word: item.word,
    phonetic: item.phonetic,
    senses: senseListOf(item.senses),
    facts: [{ label: '来源', value: NEW_WORD_SOURCE_LABELS[item.source] || '—' }],
  }
}

/**
 * 结果页「本文用到的词」：个人词库条目 → 浮层数据
 *
 * 不直接复用 myWordDetail：复习轮次 / 下次复习会随学习进度变化，
 * 而这里只回答「这个词是什么词性、什么意思」。
 */
export function usedWordDetail(item) {
  return {
    word: item.word,
    phonetic: item.phonetic,
    senses: senseListOf(item.senses),
    facts: [{ label: '来源', value: SOURCE_LABELS[item.source] || '你的词库' }],
  }
}

/** 词典兜底条目 → 浮层数据（个人词库查不到时使用） */
export function dictionaryWordDetail(entry) {
  return {
    word: entry.headword,
    phonetic: entry.phonetic,
    senses: senseListOf(entry.senses),
    facts: [{ label: '来源', value: '词库' }],
  }
}
