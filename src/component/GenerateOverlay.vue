<script setup>
/**
 * 全局生成覆盖层
 *
 * 用途：首页、设置页（以及后续结果页“再练一次”）共用的生成进度与失败提示。
 *       覆盖层不是独立路由，刷新会丢失生成态，这是可接受的限制。
 * 用法：在 AppLayout 中挂载一次 <GenerateOverlay />，页面只调用 useGenerateReading().start()
 *
 * 行为：
 *   - 生成中（creating / generating / fetching）：浮动书本图标、不定长进度条、
 *     每 2.5s 轮换提示、可取消；/generating 页有自己的纸页动画，那里不再叠这一层
 *   - 生成在其他页面完成（例如从生成页离开）：补上「进入阅读页」的落点
 *   - 词汇不够（INSUFFICIENT_VOCABULARY / VOCABULARY_TOO_SMALL）：
 *     去添加单词 / 降低难度 / 缩短文章，按当前处境只显示有效的那个
 *   - 限流（429 RATE_LIMITED）：说「太频繁」，不给重试（窗口内重试必然还是 429）
 *   - 免费次数用尽（429 QUOTA_EXCEEDED）：说明这是「免费」额度，并给
 *     「去接入 API Key」+「返回修改」（md/35 §9 第 3 条）
 *   - 免费池用尽（503 FREE_BUDGET_EXHAUSTED）：不会自行恢复，没有倒计时，
 *     原样透传后端 message，给「去接入 API Key」+「知道了」（md/36 §10）
 *   - 自备 Key 失效（403 USER_API_KEY_INVALID / 409 USER_API_KEY_MISSING）：
 *     Key 不变时重试没有意义，不给「重试」，只给「去设置」（md/43 §9）
 *   - 临时拥塞（503 GENERATION_SATURATED / AI_PROVIDER_BUSY）与整篇超时
 *     （504 / failed GENERATION_TIMEOUT）：都是「等几秒再来」，按钮按 Retry-After
 *     置灰倒计时，超时那次用「重新生成」（后端 md/55 §8、md/22 第 68–70 行）
 *   - 其他错误：retryable 为 false 时只给「返回修改」，否则「重试」走任务 /retry，
 *     复用已写好的段，不重新建任务
 *   - 打开时锁定背景滚动，焦点落到首个按钮，Esc 取消或关闭
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, BookOpen } from 'lucide-vue-next'
import BaseButton from './BaseButton.vue'
import { useGenerateReading } from '../composables/useGenerateReading'
import { useReadingStore } from '../stores/model/reading'
import { useSettingsStore } from '../stores/model/settings'
import {
  describeFocusWords,
  describeFreeBudgetExhausted,
  describeGenerationSaturated,
  describeGenerationTimeout,
  describeProviderBusy,
  describeQuotaExceeded,
  describeRateLimit,
  describeUserApiKeyProblem,
  describeVocabShortage,
} from '../unit/error-text'
import { TARGET_WORDS_MIN } from '../unit/validators'

const TIPS = ['文章只会使用你学过的词', '正在检查词汇范围', '马上就好']
const LEVEL_LABELS = { easy: '简单', medium: '进阶', hard: '挑战' }
const LEVEL_ORDER = ['easy', 'medium', 'hard']
// 这些页面自己处理生成成功后的落点，覆盖层不要抢导航
const READING_ROUTES = ['generating', 'reading', 'reading-result']
const FOCUSABLE_SELECTOR = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])'

const router = useRouter()
const route = useRoute()
const settings = useSettingsStore()
const readingStore = useReadingStore()
const { error, summary, task, isGenerating, retry, cancel, dismiss } = useGenerateReading()

const dialogRef = ref(null)
const tipIndex = ref(0)

let tipTimer = null
let lastActiveElement = null

// 两道「词不够」的码：20 词兜底 + 主闸门（A 门 target_words / B 门 known_words）
const INSUFFICIENT_CODES = ['INSUFFICIENT_VOCABULARY', 'VOCABULARY_TOO_SMALL']

// 生成页用纸页动画承担「进行中」的反馈，覆盖层只负责错误
const isPaperPage = computed(() => route.name === 'generating')
const isOpen = computed(() => Boolean(error.value) || (isGenerating.value && !isPaperPage.value))
const errorCode = computed(() => error.value?.code || '')
const isInsufficient = computed(() => INSUFFICIENT_CODES.includes(errorCode.value))
// easy 已经是最低档，降低难度点了也不会有反应
const canLower = computed(() => summary.value.level !== 'easy')
// 到下限就没有可缩的了，再缩后端会 400
const canShorten = computed(() => Number(summary.value.targetWords) > TARGET_WORDS_MIN)
const levelLabel = computed(() => LEVEL_LABELS[summary.value.level] || '简单')
const basisText = computed(() =>
  summary.value.availableWords == null
    ? '基于你的词汇库'
    : `基于你的 ${summary.value.availableWords} 个单词`,
)
// 两个入口：老的 20 词兜底没有 details，其余业务错误一律靠 details.kind 识别
// 自选词失效也是 details.kind 结构（kind = 'focus_words'），必须先分流出去，
// 否则会被当成「词不够」，给出缩短篇幅 / 降难度这些毫无用处的建议（md/54 §3.2）
const isFocusWordsProblem = computed(() => errorCode.value === 'FOCUS_WORDS_NOT_LEARNED')
const hasVocabDetails = computed(
  () => Boolean(error.value?.details?.kind) && !isFocusWordsProblem.value,
)

const vocabShortage = computed(() =>
  isInsufficient.value || hasVocabDetails.value
    ? describeVocabShortage({ code: errorCode.value, details: error.value?.details })
    : null,
)

// 主按钮取文案层给的 primaryAction；对应按钮不存在时（已到最短篇幅 / 已是最低难度）顺延，
// 避免主色落在一个不渲染的出口上，整排按钮都变成次要样式
const vocabPrimaryAction = computed(() => {
  const card = vocabShortage.value
  if (!card) return ''

  const visible = card.actions.filter((action) => {
    if (action === 'shorten') return canShorten.value
    if (action === 'lower') return canLower.value
    return true
  })

  return visible.includes(card.primaryAction) ? card.primaryAction : visible[0] || ''
})

// 失效词只能改选：这几个词不变，重试多少次都是同一个 422
const focusWordsProblem = computed(() =>
  isFocusWordsProblem.value ? describeFocusWords({ details: error.value?.details }) : null,
)

// 429 单独说「太频繁」：窗口内重试一定还是 429，给「重试」按钮等于骗用户多点一次
const isRateLimited = computed(() => errorCode.value === 'RATE_LIMITED')
const rateLimit = computed(() =>
  isRateLimited.value ? describeRateLimit({ details: error.value?.details }) : null,
)

// 429 QUOTA_EXCEEDED 与分钟级限流分开：恢复时间是明天 0 点，文案按 scope 说清是哪一档
const isQuotaExceeded = computed(() => errorCode.value === 'QUOTA_EXCEEDED')
const quotaExceeded = computed(() =>
  isQuotaExceeded.value ? describeQuotaExceeded({ details: error.value?.details }) : null,
)

// 503 FREE_BUDGET_EXHAUSTED 与每日额度分开：免费池不会「明天恢复」，
// 没有 resetAt / Retry-After，唯一出口是接入自己的 API Key（md/36 §10 ①②③）
const isFreeBudgetExhausted = computed(() => errorCode.value === 'FREE_BUDGET_EXHAUSTED')
const freeBudgetExhausted = computed(() =>
  isFreeBudgetExhausted.value ? describeFreeBudgetExhausted() : null,
)

// 自备 Key 失效：登录状态正常，只是这把 Key 不能用了。出口在个人中心，
// 留在这里点「重试」只会再失败一次（md/43 §9）
const USER_KEY_CODES = ['USER_API_KEY_INVALID', 'USER_API_KEY_MISSING']
const isApiKeyProblem = computed(() => USER_KEY_CODES.includes(errorCode.value))
const apiKeyProblem = computed(() =>
  isApiKeyProblem.value ? describeUserApiKeyProblem({ code: errorCode.value }) : null,
)

// 临时拥塞与整篇超时（后端 md/55 §8）：用户没做错什么，不给「缩短 / 降难度」这类建议，
// 只给「等几秒再来」和一个能走的出口
const isSaturated = computed(() => errorCode.value === 'GENERATION_SATURATED')
const saturated = computed(() =>
  isSaturated.value ? describeGenerationSaturated({ details: error.value?.details }) : null,
)

const isProviderBusy = computed(() => errorCode.value === 'AI_PROVIDER_BUSY')
const providerBusy = computed(() =>
  isProviderBusy.value ? describeProviderBusy({ details: error.value?.details }) : null,
)

const isGenerationTimeout = computed(() => errorCode.value === 'GENERATION_TIMEOUT')
const generationTimeout = computed(() =>
  isGenerationTimeout.value ? describeGenerationTimeout({ details: error.value?.details }) : null,
)

// 三种拥塞态共用一个出口：冷却中的「重试」+「先不生成」
const isCongested = computed(
  () => isSaturated.value || isProviderBusy.value || isGenerationTimeout.value,
)

// Retry-After 冷却：后端给几秒就置灰几秒。remainingSeconds 由 reading store 从
// 响应头 / 任务 details 里算好；这里只负责每秒往下数，不自己猜时间（md/22 §8.5 ③）
const cooldownSeconds = ref(0)
let cooldownTimer = null

function stopCooldown() {
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = null
}

function startCooldown(seconds) {
  stopCooldown()
  cooldownSeconds.value = Math.max(0, Math.ceil(seconds))
  if (!cooldownSeconds.value) return

  cooldownTimer = setInterval(() => {
    cooldownSeconds.value -= 1
    if (cooldownSeconds.value <= 0) stopCooldown()
  }, 1000)
}

// 超时不是「接上次继续」，是整篇重跑：按钮文案要说清这件事（md/55 §8 建议）
const RETRY_LABELS = { GENERATION_TIMEOUT: '重新生成', AI_PROVIDER_BUSY: '稍后重试' }
const retryLabel = computed(() => {
  const base = RETRY_LABELS[errorCode.value] || '重试'
  return cooldownSeconds.value > 0 ? `${base}（${cooldownSeconds.value}s）` : base
})

// retryable === false 的（词不够、参数错、额度用完、免费池用尽）重试只会再失败一次，按钮不该给；
// 本地建任务失败（网络 / 429）没有这个字段，按可重试处理
// Key 失效单独排除：后端任务失败可能不带 retryable，不能只靠这个字段
const canRetry = computed(
  () =>
    error.value?.retryable !== false &&
    !isQuotaExceeded.value &&
    !isFreeBudgetExhausted.value &&
    !isApiKeyProblem.value &&
    !isFocusWordsProblem.value,
)
// retryCount 只用于标题区分第几次尝试，不参与「复用了几段」的数量计算（md/22 §8.5 ②）
const attemptTitle = computed(() => {
  const retryCount = Number(task.value?.retryCount) || 0
  return retryCount > 0 ? `第 ${retryCount + 1} 次尝试没有成功` : ''
})

const errorTitle = computed(() => {
  if (focusWordsProblem.value) return focusWordsProblem.value.title
  if (vocabShortage.value) return vocabShortage.value.title
  if (apiKeyProblem.value) return apiKeyProblem.value.title
  if (saturated.value) return saturated.value.title
  if (providerBusy.value) return providerBusy.value.title
  if (generationTimeout.value) return generationTimeout.value.title
  if (freeBudgetExhausted.value) return freeBudgetExhausted.value.title
  if (quotaExceeded.value) return quotaExceeded.value.title
  if (rateLimit.value) return rateLimit.value.title
  if (attemptTitle.value) return attemptTitle.value

  return '这次生成没有成功'
})
const errorHint = computed(() => {
  if (focusWordsProblem.value) return focusWordsProblem.value.hint
  if (vocabShortage.value) return vocabShortage.value.hint
  if (apiKeyProblem.value) return apiKeyProblem.value.hint
  if (saturated.value) return saturated.value.hint
  if (providerBusy.value) return providerBusy.value.hint
  if (generationTimeout.value) return generationTimeout.value.hint
  // 免费池用尽没有可补的信息，后端 message 已经把「接入自己的 API Key」说清楚
  if (freeBudgetExhausted.value) return ''
  if (quotaExceeded.value) return quotaExceeded.value.hint
  if (rateLimit.value) return rateLimit.value.hint

  return '可以稍后再试，或返回设置调整参数。'
})

function startTips() {
  tipIndex.value = 0
  stopTips()
  tipTimer = setInterval(() => {
    tipIndex.value = (tipIndex.value + 1) % TIPS.length
  }, 2500)
}

function stopTips() {
  if (tipTimer) clearInterval(tipTimer)
  tipTimer = null
}

function focusFirstButton() {
  dialogRef.value?.querySelector('button')?.focus()
}

function handleEscape() {
  if (isGenerating.value) cancel()
  else dismiss()
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    handleEscape()
    return
  }

  if (event.key !== 'Tab') return

  const focusable = Array.from(dialogRef.value?.querySelectorAll(FOCUSABLE_SELECTOR) || [])
  if (!focusable.length) {
    event.preventDefault()
    dialogRef.value?.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function goAddWords() {
  dismiss()
  router.push('/words')
}

function goReview() {
  dismiss()
  router.push('/words/review')
}

function lowerDifficulty() {
  const index = LEVEL_ORDER.indexOf(summary.value.level)
  const nextLevel = LEVEL_ORDER[Math.max(0, index - 1)] || 'easy'
  settings.save({ level: nextLevel })
  dismiss()
  router.push('/settings')
}

function shortenArticle() {
  const current = Number(summary.value.targetWords) || TARGET_WORDS_MIN
  const next = Math.max(TARGET_WORDS_MIN, current - 50)

  // 已经到下限就不再写设置：写了也是同一个值，还会让用户白跑一趟设置页
  if (next === current) return

  settings.save({ targetWords: next })
  dismiss()
  router.push('/settings')
}

function backToSettings() {
  dismiss()
  if (route.name !== 'settings') router.push('/settings')
}

/** 自备 Key 的唯一出口：额度用尽或 Key 失效都落到个人中心的 API 设置卡 */
function goApiSettings() {
  dismiss()
  if (route.name !== 'profile') router.push({ path: '/profile', hash: '#api-settings' })
}

async function handleRetry() {
  // 重试由 store 决定：任务终态走 /retry（复用已写好的段），建任务失败才重新建
  const started = await retry()
  if (!started) return

  // 失败发生在设置页 / 首页时，动画仍在生成页：把用户带过去，别留在遮罩里干等
  if (route.name !== 'generating') router.push('/generating')
}

// 从生成页离开后生成才完成时，入口页已经没有「await 完再跳」的代码了，这里补上落点
watch(
  () => readingStore.reading?.id,
  (id) => {
    if (!id || READING_ROUTES.includes(route.name)) return
    router.push(`/readings/${id}`)
  },
)

watch(
  isGenerating,
  (active) => {
    if (active) startTips()
    else stopTips()
  },
  { immediate: true },
)

watch(
  isOpen,
  async (open) => {
    if (open) {
      lastActiveElement = document.activeElement
      document.body.classList.add('has-modal-open')
      await nextTick()
      focusFirstButton()
    } else {
      document.body.classList.remove('has-modal-open')
      if (lastActiveElement instanceof HTMLElement) lastActiveElement.focus()
      lastActiveElement = null
    }
  },
  { immediate: true },
)

// 错误对象换了就重置倒计时：store 会回填 remainingSeconds（按当前时刻算出来的剩余），
// 没有时退回 details.retryAfter（后端给的原始等待秒数），两者都没有就不显示倒计时
watch(
  () => Number(error.value?.details?.remainingSeconds ?? error.value?.details?.retryAfter) || 0,
  (seconds) => {
    if (seconds > 0) startCooldown(seconds)
    else {
      stopCooldown()
      cooldownSeconds.value = 0
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopTips()
  stopCooldown()
  document.body.classList.remove('has-modal-open')
})
</script>

<template>
  <Teleport to="body">
    <Transition name="generate">
      <div v-if="isOpen" class="generate-overlay">
        <div
          ref="dialogRef"
          class="generate-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="generate-title"
          tabindex="-1"
          @keydown="handleKeydown"
        >
          <template v-if="isGenerating">
            <div class="illustration is-floating" aria-hidden="true">
              <BookOpen :size="34" :stroke-width="1.4" />
            </div>

            <h2 id="generate-title" class="generate-title">正在为你生成专属文章…</h2>
            <p class="generate-subtitle">
              {{ basisText }} · 难度：{{ levelLabel }} · 约 {{ summary.targetWords }} 词
            </p>

            <div class="progress" role="progressbar" aria-label="正在生成">
              <span class="progress-bar" />
            </div>

            <p class="generate-tip" aria-live="polite">{{ TIPS[tipIndex] }}</p>

            <BaseButton variant="ghost" @click="cancel">取消生成</BaseButton>
          </template>

          <template v-else>
            <div class="illustration is-error" aria-hidden="true">
              <AlertCircle :size="32" :stroke-width="1.5" />
            </div>

            <h2 id="generate-title" class="generate-title">{{ errorTitle }}</h2>
            <!-- 命中词汇类错误时后端 message 与 hint 说的是同一件事，只留 hint；
                 429（限流 / 额度）与 Key 失效同样按 code 给文案，后端 message 会重复一遍 -->
            <p
              v-if="
                !vocabShortage &&
                !rateLimit &&
                !quotaExceeded &&
                !apiKeyProblem &&
                !focusWordsProblem &&
                !isCongested
              "
              class="generate-subtitle"
            >
              {{ error?.message }}
            </p>
            <p v-if="errorHint" class="generate-hint">{{ errorHint }}</p>
            <!-- 只有真实后端才带 requestId，mock 时这一行自然不出现 -->
            <p v-if="error?.requestId" class="generate-id">错误编号：{{ error.requestId }}</p>

            <div v-if="vocabShortage" class="generate-actions">
              <!-- 词源是「今天复习」且池子为空：缩短 / 降难度都没用，去复习才走得通 -->
              <BaseButton
                v-if="vocabShortage.actions.includes('review')"
                :variant="vocabPrimaryAction === 'review' ? 'primary' : 'secondary'"
                @click="goReview"
              >
                去复习
              </BaseButton>
              <BaseButton
                v-if="vocabShortage.actions.includes('shorten') && canShorten"
                :variant="vocabPrimaryAction === 'shorten' ? 'primary' : 'secondary'"
                @click="shortenArticle"
              >
                缩短文章
              </BaseButton>
              <BaseButton
                v-if="vocabShortage.actions.includes('lower') && canLower"
                :variant="vocabPrimaryAction === 'lower' ? 'primary' : 'secondary'"
                @click="lowerDifficulty"
              >
                降低难度
              </BaseButton>
              <BaseButton
                v-if="vocabShortage.actions.includes('add')"
                :variant="vocabPrimaryAction === 'add' ? 'primary' : 'secondary'"
                @click="goAddWords"
              >
                去添加单词
              </BaseButton>
            </div>
            <!-- 免费池用尽后改参数也没用（任何入口都会 503），出口是接入自己的 Key -->
            <div v-else-if="isFreeBudgetExhausted" class="generate-actions">
              <BaseButton variant="secondary" @click="dismiss">知道了</BaseButton>
              <BaseButton @click="goApiSettings">去接入 API Key</BaseButton>
            </div>
            <!-- Key 失效：改参数 / 重试都没用，先换 Key 再回来生成 -->
            <div v-else-if="isApiKeyProblem" class="generate-actions">
              <BaseButton @click="goApiSettings">去设置</BaseButton>
            </div>
            <!-- 每日免费次数用完：可以等明天，也可以接入自己的 Key 继续生成 -->
            <div v-else-if="quotaExceeded" class="generate-actions">
              <BaseButton variant="secondary" @click="backToSettings">返回修改</BaseButton>
              <BaseButton @click="goApiSettings">去接入 API Key</BaseButton>
            </div>
            <div v-else-if="rateLimit" class="generate-actions">
              <BaseButton variant="secondary" @click="backToSettings">返回修改</BaseButton>
              <BaseButton @click="dismiss">知道了</BaseButton>
            </div>
            <!-- 队满 / 上游繁忙 / 整篇超时：参数没错，别让人回设置页白跑一趟；
                 冷却未结束时按钮置灰，点了也只会再撞一次 -->
            <div v-else-if="isCongested" class="generate-actions">
              <BaseButton variant="secondary" @click="dismiss">先不生成</BaseButton>
              <BaseButton :disabled="cooldownSeconds > 0" @click="handleRetry">
                {{ retryLabel }}
              </BaseButton>
            </div>
            <div v-else class="generate-actions">
              <BaseButton variant="secondary" @click="backToSettings">返回修改</BaseButton>
              <BaseButton v-if="canRetry" @click="handleRetry">重试</BaseButton>
            </div>
            <p
              v-if="canRetry && !vocabShortage && !rateLimit && !quotaExceeded && !isSaturated"
              class="generate-note"
            >
              会从上次中断的地方继续，已经写好的部分不会重来
            </p>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.generate-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  background: rgba(245, 240, 230, 0.96);
  backdrop-filter: blur(2px);
}

.generate-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 560px;
  padding: var(--space-10) var(--space-8) var(--space-8);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-2xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  text-align: center;
  outline: none;
}

.illustration {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin-bottom: var(--space-5);
  border-radius: 50%;
  background: var(--color-bg-deep);
  color: var(--color-primary);
}

.illustration.is-floating {
  animation: generate-float 2s var(--ease-in-out) infinite;
}

.illustration.is-error {
  color: var(--color-accent);
}

.generate-title {
  font-family: var(--font-display);
  font-size: var(--text-section);
  line-height: var(--leading-section);
  letter-spacing: 0.02em;
}

.generate-subtitle {
  max-width: 40ch;
  margin-top: var(--space-2);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.generate-hint {
  max-width: 42ch;
  margin-top: var(--space-2);
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.generate-id {
  margin-top: var(--space-2);
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  font-variant-numeric: tabular-nums;
}

.generate-note {
  max-width: 34ch;
  margin-top: var(--space-3);
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.progress {
  position: relative;
  width: min(320px, 100%);
  height: 4px;
  margin-top: var(--space-6);
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-bg-deep);
}

.progress-bar {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40%;
  border-radius: var(--radius-pill);
  background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
  animation: generate-progress 1.4s var(--ease-in-out) infinite;
}

.generate-tip {
  min-height: 20px;
  margin-top: var(--space-4);
  margin-bottom: var(--space-6);
  color: var(--color-accent);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.generate-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-6);
}

.generate-enter-active {
  transition: opacity var(--dur-page) var(--ease-out);
}

.generate-leave-active {
  transition: opacity 160ms var(--ease-in-out);
}

.generate-enter-from,
.generate-leave-to {
  opacity: 0;
}

.generate-enter-active .generate-dialog {
  transition: transform var(--dur-page) var(--ease-out);
}

.generate-enter-from .generate-dialog {
  transform: scale(0.97);
}

@keyframes generate-float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-4px);
  }
}

@keyframes generate-progress {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(350%);
  }
}

@media (prefers-reduced-motion: reduce) {
  /* 全局规则会把时长压到 0.01ms，但终态仍会位移，这里直接不播 */
  .illustration.is-floating,
  .progress-bar {
    animation: none;
  }
}

@media (max-width: 767px) {
  .generate-overlay {
    padding: var(--space-4);
  }

  .generate-dialog {
    padding: var(--space-8) var(--space-5) var(--space-6);
  }

  .generate-actions {
    width: 100%;
  }

  .generate-actions :deep(.base-button) {
    flex: 1 1 auto;
  }
}
</style>
