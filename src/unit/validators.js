/**
 * 运行时校验
 * 纯 JavaScript 项目不使用类型系统，所有外部输入（表单、接口参数）在此统一校验。
 * 返回 { valid, errors } 结构，errors 以字段名为键，便于表单逐项展示。
 */

export const WORD_STATUSES = ['new', 'learning', 'mastered']
export const WORD_SOURCES = ['dictionary', 'manual']
export const LEVELS = ['easy', 'medium', 'hard']
export const QUESTION_COUNTS = [3, 5, 8]
export const TARGET_WORDS_MIN = 50
export const TARGET_WORDS_MAX = 300
export const TARGET_WORDS_STEP = 10
export const WORD_MAX_LENGTH = 45
export const MEANING_MAX_LENGTH = 100
export const VOCABULARY_THRESHOLD = 20

const WORD_PATTERN = /^[a-z'-]+$/

/** 去首尾空格并统一小写，作为单词的唯一存储形式 */
export function normalizeWord(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

export function isValidWordStatus(value) {
  return WORD_STATUSES.includes(value)
}

/**
 * 校验新增/编辑单词的输入
 * 返回规范化后的 word 与 meaning，调用方直接使用，避免重复清洗
 *
 * mode 决定释义的校验方式：
 *   manual     — 用户手填，meaning 可选、≤100 字（与旧行为一致）
 *   dictionary — 命中词库，meaning 不参与校验，改为要求 senses 至少一条且每条释义合规
 */
export function validateWordInput({ word, meaning, mode = 'manual', senses } = {}) {
  const errors = {}
  const normalizedWord = normalizeWord(word)
  const normalizedMeaning = String(meaning ?? '').trim()
  const isDictionary = mode === 'dictionary'

  if (!normalizedWord) {
    errors.word = '请输入英文单词'
  } else if (normalizedWord.length > WORD_MAX_LENGTH) {
    errors.word = `单词长度不能超过 ${WORD_MAX_LENGTH} 个字符`
  } else if (!WORD_PATTERN.test(normalizedWord)) {
    errors.word = '单词只能包含字母、连字符和撇号'
  }

  if (isDictionary) {
    if (!Array.isArray(senses) || !senses.length) {
      errors.senses = '请选择词条'
    } else if (
      senses.some((sense) => {
        const text = String(sense?.meaning ?? '').trim()
        return !text || text.length > MEANING_MAX_LENGTH
      })
    ) {
      errors.senses = '词条的释义格式不正确'
    }
  } else if (normalizedMeaning.length > MEANING_MAX_LENGTH) {
    errors.meaning = `中文释义不能超过 ${MEANING_MAX_LENGTH} 个字符`
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    word: normalizedWord,
    meaning: normalizedMeaning,
  }
}

/** 校验阅读设置；文章长度必须是 10 的倍数且在 50～300 之间 */
export function validateSettings({ level, targetWords, questionCount } = {}) {
  const errors = {}
  const words = Number(targetWords)

  if (!LEVELS.includes(level)) errors.level = '请选择难度'
  if (
    !Number.isInteger(words) ||
    words < TARGET_WORDS_MIN ||
    words > TARGET_WORDS_MAX ||
    words % TARGET_WORDS_STEP !== 0
  ) {
    errors.targetWords = `文章长度需在 ${TARGET_WORDS_MIN}～${TARGET_WORDS_MAX} 词之间，且为 ${TARGET_WORDS_STEP} 的倍数`
  }
  if (!QUESTION_COUNTS.includes(questionCount)) errors.questionCount = '题目数量只能是 3、5 或 8'

  return { valid: Object.keys(errors).length === 0, errors }
}

/** 取第一个错误文案与字段名，供 Toast 与表单高亮复用 */
export function firstError(errors = {}) {
  const field = Object.keys(errors)[0]
  return { field: field || '', message: field ? errors[field] : '' }
}
