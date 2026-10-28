/**
 * 单词详情（浮层）的展示数据
 * 两个页面共用一套结构：单词 + 音标 + 全部义项 + 若干「标签 / 值」事实行。
 * 数据全部来自列表接口的快照，这里只做映射，不发请求（见 md/17 §2）。
 */
import { meaningOf, statusOf } from './basic-words'
import { formatDate } from './format'
import { frequencyTierOf } from './word-tiers'

const KIND_LABELS = { basic: '基础词', calendar: '日历词', abbreviation: '缩写' }
const SOURCE_LABELS = { dictionary: '词库', manual: '手填', 'basic-removed': '从基础词表移除' }

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
    facts.push({
      label: '我的单词',
      value: item.personalStatus === 'mastered' ? '已掌握' : '学习中',
    })
  }

  if (item.removed) {
    facts.push({ label: '标记', value: '已标为不认识，可恢复' })
  } else if (!item.removable) {
    facts.push({
      label: '标记',
      value: item.isFunctionWord ? '功能词，不可标记' : '只读词，不可标记',
    })
  } else if (!item.personalStatus) {
    facts.push({ label: '标记', value: '可标为不认识' })
  } else {
    facts.push({ label: '标记', value: '已在词库中，去我的单词修改' })
  }

  if (item.expansion) facts.push({ label: '英文全称', value: item.expansion })

  return {
    word: item.word,
    phonetic: item.phonetic,
    senses: basicSensesOf(item),
    facts,
  }
}

/** 我的单词：来源、词频、收录时间；义项直接用快照里的全部 senses */
export function myWordDetail(item) {
  const facts = [
    { label: '来源', value: SOURCE_LABELS[item.source] || '—' },
    { label: '收录', value: formatDate(item.createdAt) || '—' },
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
