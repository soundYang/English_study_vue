/**
 * 单词朗读
 *
 * 用途：词条与详情页的喇叭按钮共用；调用浏览器 Web Speech API，
 *       不支持（如 jsdom、部分旧浏览器）或没有可用语音时静默失败。
 * 说明：不请求网络、不引入音频资源；发音质量取决于用户系统语音包。
 */

/**
 * 朗读一个英文单词
 *
 * @param {string} word 要朗读的词
 * @returns {boolean} 是否成功发起朗读；不支持时返回 false，调用方可据此隐藏按钮
 */
export function speakWord(word) {
  const text = String(word ?? '').trim()
  if (!text) return false

  if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') return false

  try {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.9

    // 连续点多个词时先取消上一条，避免排队念完一整列
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    return true
  } catch {
    return false
  }
}

/** 当前环境是否能朗读；用于决定要不要渲染喇叭按钮 */
export function canSpeak() {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined'
}
