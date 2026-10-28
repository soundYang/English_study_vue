<script setup>
/**
 * 全局生成覆盖层
 *
 * 用途：首页、设置页（以及后续结果页“再练一次”）共用的生成进度与失败提示。
 *       覆盖层不是独立路由，刷新会丢失生成态，这是可接受的限制。
 * 用法：在 AppLayout 中挂载一次 <GenerateOverlay />，页面只调用 useGenerateReading().start()
 *
 * 行为：
 *   - 生成中：浮动书本图标、不定长进度条、每 2.5s 轮换提示、可取消
 *   - 词汇不够（INSUFFICIENT_VOCABULARY / VOCABULARY_TOO_SMALL）：
 *     去添加单词 / 降低难度 / 缩短文章，按当前处境只显示有效的那个
 *   - 其他错误：重试 / 返回修改
 *   - 打开时锁定背景滚动，焦点落到首个按钮，Esc 取消或关闭
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, BookOpen } from 'lucide-vue-next'
import BaseButton from './BaseButton.vue'
import { useGenerateReading } from '../composables/useGenerateReading'
import { useSettingsStore } from '../stores/model/settings'
import { describeVocabShortage } from '../unit/error-text'
import { TARGET_WORDS_MIN } from '../unit/validators'

const TIPS = ['文章只会使用你学过的词', '正在检查词汇范围', '马上就好']
const LEVEL_LABELS = { easy: '简单', medium: '进阶', hard: '挑战' }
const LEVEL_ORDER = ['easy', 'medium', 'hard']
const FOCUSABLE_SELECTOR = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])'

const router = useRouter()
const route = useRoute()
const settings = useSettingsStore()
const { phase, error, summary, isGenerating, start, cancel, dismiss } = useGenerateReading()

const dialogRef = ref(null)
const tipIndex = ref(0)

let tipTimer = null
let lastActiveElement = null

// 两道「词不够」的码：20 词兜底 + 主闸门（A 门 target_words / B 门 known_words）
const INSUFFICIENT_CODES = ['INSUFFICIENT_VOCABULARY', 'VOCABULARY_TOO_SMALL']

const isOpen = computed(() => phase.value === 'generating' || Boolean(error.value))
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
const hasVocabDetails = computed(() => Boolean(error.value?.details?.kind))

const vocabShortage = computed(() =>
  isInsufficient.value || hasVocabDetails.value
    ? describeVocabShortage({ code: errorCode.value, details: error.value?.details })
    : null,
)

const errorTitle = computed(() =>
  vocabShortage.value ? vocabShortage.value.title : '这次生成没有成功',
)
const errorHint = computed(() =>
  vocabShortage.value ? vocabShortage.value.hint : '可以稍后再试，或返回设置调整参数。',
)

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

async function retry() {
  const { level, targetWords, questionCount, availableWords } = summary.value
  const generated = await start({ level, targetWords, questionCount }, { availableWords })
  if (generated) router.push(`/readings/${generated.id}`)
}

watch(
  phase,
  (next) => {
    if (next === 'generating') startTips()
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

onBeforeUnmount(() => {
  stopTips()
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
            <!-- 命中词汇类错误时后端 message 与 hint 说的是同一件事，只留 hint -->
            <p v-if="!vocabShortage" class="generate-subtitle">{{ error?.message }}</p>
            <p class="generate-hint">{{ errorHint }}</p>

            <div v-if="vocabShortage" class="generate-actions">
              <BaseButton
                v-if="vocabShortage.actions.includes('shorten') && canShorten"
                variant="secondary"
                @click="shortenArticle"
              >
                缩短文章
              </BaseButton>
              <BaseButton
                v-if="vocabShortage.actions.includes('lower') && canLower"
                variant="secondary"
                @click="lowerDifficulty"
              >
                降低难度
              </BaseButton>
              <BaseButton v-if="vocabShortage.actions.includes('add')" @click="goAddWords">
                去添加单词
              </BaseButton>
            </div>
            <div v-else class="generate-actions">
              <BaseButton variant="secondary" @click="backToSettings">返回修改</BaseButton>
              <BaseButton @click="retry">重试</BaseButton>
            </div>
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
