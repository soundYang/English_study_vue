<script setup>
/**
 * 阅读答题视图
 * 在无答案、无翻译的安全状态下完成阅读与作答。
 * 数据由路由守卫预先加载；本页负责双栏布局、计时、题目进度、提交确认与导航。
 * 答案与剩余时间只写入 sessionStorage，提交成功后由 store 清除。
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../component/BaseButton.vue'
import BaseModal from '../../component/BaseModal.vue'
import ConfirmDialog from '../../component/ConfirmDialog.vue'
import GuestGate from '../../component/GuestGate.vue'
import SegmentedControl from '../../component/SegmentedControl.vue'
import WordDetailPopover from '../../component/WordDetailPopover.vue'
import ArticleCard from './component/ArticleCard.vue'
import NewWordsPanel from './component/NewWordsPanel.vue'
import QuestionList from './component/QuestionList.vue'
import UsedWordsPanel from './component/UsedWordsPanel.vue'
import ReadingHeader from './component/ReadingHeader.vue'
import ReadingSkeleton from './component/ReadingSkeleton.vue'
import SubmitBar from './component/SubmitBar.vue'
import { useAuthGate } from '../../composables/useAuthGate'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { useReadingTimer } from '../../composables/useReadingTimer'
import { useScrollSpy } from '../../composables/useScrollSpy'
import { useToast } from '../../composables/useToast'
import { useAuthStore } from '../../stores/model/auth'
import { useReadingStore } from '../../stores/model/reading'
import { newWordDetail } from '../../unit/word-detail'

const PANEL_OPTIONS = [
  { value: 'article', label: '文章' },
  { value: 'questions', label: '题目' },
]

const route = useRoute()
const router = useRouter()
const toast = useToast()
const store = useReadingStore()
const auth = useAuthStore()
const { goLogin } = useAuthGate()
const isMobile = useMediaQuery('(max-width: 767px)')
// 正文属于账号数据：游客只渲染整页登录引导，不请求详情（md/45 §5.7）
const isGuest = computed(() => !auth.isAuthenticated)

const activePanel = ref('article')
const unansweredOpen = ref(false)
const exitOpen = ref(false)
const questionColumn = ref(null)
// 未学词清单默认收起，标题行只留一个胶囊入口
const newWordsOpen = ref(false)
// 正文里点开的未学词：{ entry, anchor }，为空即关闭
const detailTarget = ref(null)

const { activeId, observe } = useScrollSpy()
const {
  remaining: timerRemaining,
  start: startTimer,
  stop: stopTimer,
} = useReadingTimer({
  initialSeconds: store.remainingSeconds,
  onTick: (value) => store.setRemainingSeconds(value),
})

let activatedId = ''

const reading = computed(() => store.reading)
const questions = computed(() => store.reading?.questions || [])
const isNotFound = computed(() => store.loadError?.code === 'READING_NOT_FOUND')
const loadTitle = computed(() => (isNotFound.value ? '这篇练习不存在或已被删除' : '阅读加载失败'))
const loadDescription = computed(() =>
  isNotFound.value
    ? '你可以返回首页，重新选择一份阅读材料。'
    : store.loadError?.message || '网络出了点问题，请稍后重试。',
)

const currentNumber = computed(() => {
  const index = questions.value.findIndex(
    (question) => String(question.id) === String(activeId.value),
  )
  return index >= 0 ? index + 1 : 1
})

const unansweredCount = computed(() => Math.max(0, questions.value.length - store.answeredCount))

const isLocked = computed(() => store.submitting || store.phase === 'submitted')

const answeredIds = computed(() =>
  questions.value
    .filter((question) => store.answers[question.id] != null)
    .map((question) => question.id),
)

const unansweredTitle = computed(() => `还有 ${unansweredCount.value} 道题未作答`)

const newWords = computed(() => store.reading?.newWords || [])
// 本文用到的用户词（md/56 P2）：只含 word / count / kind，不查词库状态
const usedWords = computed(() => store.reading?.usedWords || [])
// 自选词没被写进正文（分段降级可能漏词）：只提示，不触发修复（后端 md/54）
const missingFocusWords = computed(() => store.reading?.focusWords?.missing || [])
const detailData = computed(() =>
  detailTarget.value ? newWordDetail(detailTarget.value.entry) : null,
)

function activateReading() {
  const id = store.reading?.id
  if (!id || activatedId === id) return

  activatedId = id
  startTimer(store.remainingSeconds)
  nextTick(() => observe(questionColumn.value))
}

// 换一篇练习：上篇打开的生词清单与浮层都收起来
function resetWordOverlays() {
  newWordsOpen.value = false
  detailTarget.value = null
}

function handleWordClick({ entry, anchor }) {
  if (detailTarget.value?.entry.word === entry.word) {
    detailTarget.value = null
    return
  }

  detailTarget.value = { entry, anchor }
}

function handleDetailOpen(value) {
  if (!value) detailTarget.value = null
}

watch(
  () => store.reading?.id,
  () => {
    activateReading()
    resetWordOverlays()
  },
  { flush: 'post' },
)

onMounted(async () => {
  if (isGuest.value) return

  const id = String(route.params.id ?? '')

  // 守卫已加载或已报错时不再重复请求
  if (!store.reading && !store.loadError) {
    const outcome = await store.ensureReading(id)
    if (outcome.submitted) {
      router.replace({ name: 'reading-result', params: { id } })
      return
    }
  }

  activateReading()
})

watch(
  () => route.params.id,
  async (id) => {
    if (isGuest.value || !id || String(id) === String(reading.value?.id)) return
    stopTimer()
    activatedId = ''
    const outcome = await store.ensureReading(String(id))
    if (outcome.submitted) {
      router.replace({ name: 'reading-result', params: { id: String(id) } })
    }
  },
)

function selectAnswer(questionId, optionIndex) {
  store.setAnswer(questionId, optionIndex)
}

async function jumpToQuestion(questionId) {
  if (isMobile.value && activePanel.value !== 'questions') {
    activePanel.value = 'questions'
    await nextTick()
  }

  const target = questionColumn.value?.querySelector(`[data-question-id="${questionId}"]`)
  if (!target) return

  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
}

function beginSubmit() {
  if (isLocked.value) return

  if (unansweredCount.value > 0) {
    unansweredOpen.value = true
    return
  }

  submitNow()
}

async function submitNow() {
  unansweredOpen.value = false
  if (store.submitting) return

  const outcome = await store.submit()

  if (outcome.ok || outcome.code === 'ALREADY_SUBMITTED') {
    stopTimer()
    router.replace({ name: 'reading-result', params: { id: String(route.params.id) } })
    return
  }

  toast.error('提交失败，请重试')
}

function askExit() {
  if (store.submitting) return
  exitOpen.value = true
}

function confirmExit() {
  exitOpen.value = false
  stopTimer()
  router.push('/history')
}

async function retryLoad() {
  if (isGuest.value) return

  const id = String(route.params.id ?? '')
  const outcome = await store.ensureReading(id, { force: true })

  if (outcome.submitted) {
    router.replace({ name: 'reading-result', params: { id } })
    return
  }

  activateReading()
}

function goHome() {
  router.push('/')
}
</script>

<template>
  <section class="reading-page">
    <GuestGate v-if="isGuest" title="请登录后查看这篇阅读" @login="goLogin(route.fullPath)" />

    <div v-else-if="store.loadError" class="state-card" role="alert">
      <h1 class="state-title">{{ loadTitle }}</h1>
      <p class="state-desc">{{ loadDescription }}</p>
      <p v-if="store.loadError?.requestId" class="state-id">
        错误编号：{{ store.loadError.requestId }}
      </p>
      <BaseButton v-if="isNotFound" @click="goHome">返回首页</BaseButton>
      <BaseButton v-else variant="secondary" @click="retryLoad">重新加载</BaseButton>
    </div>

    <ReadingSkeleton v-else-if="!reading" />

    <template v-else>
      <ReadingHeader
        :remaining="timerRemaining"
        :level="reading.level"
        :current="currentNumber"
        :total="questions.length"
        :questions="questions"
        :answered-ids="answeredIds"
        :disabled="isLocked"
        @exit="askExit"
        @jump="jumpToQuestion"
      />

      <div v-if="isMobile" class="mobile-switch">
        <SegmentedControl
          v-model="activePanel"
          :options="PANEL_OPTIONS"
          aria-label="切换文章与题目"
        />
      </div>

      <div class="reading-layout" :class="`show-${activePanel}`">
        <div class="article-column">
          <ArticleCard
            :title="reading.title"
            :article="reading.article"
            :word-count="reading.actualWords"
            :highlight-words="newWords"
            @word-click="handleWordClick"
          >
            <template #meta>
              <NewWordsPanel v-model:open="newWordsOpen" :words="newWords" inline />
              <UsedWordsPanel :words="usedWords" inline />
              <details v-if="missingFocusWords.length" class="focus-missing">
                <summary>有 {{ missingFocusWords.length }} 个自选词没写进本文</summary>
                <p>{{ missingFocusWords.join('、') }}</p>
              </details>
            </template>
          </ArticleCard>
        </div>

        <div ref="questionColumn" class="question-column">
          <section class="question-panel" aria-label="阅读理解题目">
            <div class="panel-head">
              <h2 class="panel-title">阅读理解（共 {{ questions.length }} 题）</h2>
              <span class="panel-count"
                >已答 {{ store.answeredCount }} / {{ questions.length }}</span
              >
            </div>

            <QuestionList
              :questions="questions"
              :answers="store.answers"
              :disabled="isLocked"
              @select="selectAnswer"
            />

            <SubmitBar
              :answered="store.answeredCount"
              :total="questions.length"
              :submitting="store.submitting"
              :disabled="store.phase === 'submitted'"
              @submit="beginSubmit"
            />
          </section>
        </div>
      </div>
    </template>

    <WordDetailPopover
      :open="Boolean(detailTarget)"
      :anchor="detailTarget?.anchor || null"
      :word="detailData?.word || ''"
      :phonetic="detailData?.phonetic || null"
      :senses="detailData?.senses || []"
      :facts="detailData?.facts || []"
      @update:open="handleDetailOpen"
    />

    <BaseModal
      v-model:open="unansweredOpen"
      :title="unansweredTitle"
      description="未作答的题目会按错误计算。"
      :max-width="420"
      :show-close="false"
    >
      <template #footer>
        <BaseButton variant="secondary" @click="unansweredOpen = false">继续作答</BaseButton>
        <BaseButton @click="submitNow">仍然提交</BaseButton>
      </template>
    </BaseModal>

    <ConfirmDialog
      v-model:open="exitOpen"
      title="退出本次练习？"
      description="已作答内容会临时保存。"
      confirm-text="退出练习"
      cancel-text="继续答题"
      @confirm="confirmExit"
    />
  </section>
</template>

<style scoped>
.reading-page {
  width: 100%;
}

.reading-layout {
  display: grid;
  grid-template-columns: minmax(0, 58fr) minmax(0, 42fr);
  align-items: start;
  gap: 28px;
}

.article-column {
  min-width: 0;
}

/* 自选词没写进本文：与「未学词」并排的一枚小提示，默认收起，不抢正文注意力 */
.focus-missing {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.focus-missing summary {
  cursor: pointer;
}

.focus-missing summary:focus-visible {
  outline: none;
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.focus-missing p {
  margin-top: var(--space-1);
  color: var(--color-ink-2);
}

.question-column {
  position: sticky;
  top: var(--space-5);
  max-height: calc(100vh - 112px);
  padding-right: 4px;
  overflow-y: auto;
}

.question-panel {
  padding-bottom: var(--space-2);
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.panel-title {
  font-family: var(--font-display);
  font-size: var(--text-section);
  line-height: var(--leading-section);
  letter-spacing: 0.02em;
}

.panel-count {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  white-space: nowrap;
}

.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  max-width: 520px;
  margin: var(--space-12) auto 0;
  padding: var(--space-10) var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  text-align: center;
}

.state-title {
  color: var(--color-ink-2);
  font-family: var(--font-display);
  font-size: var(--text-section);
  line-height: var(--leading-section);
}

.state-desc {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  overflow-wrap: anywhere;
}

.state-id {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.mobile-switch {
  display: none;
}

@media (max-width: 1023px) {
  .reading-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-6);
  }

  .question-column {
    position: static;
    max-height: none;
    padding-right: 0;
    overflow: visible;
  }
}

@media (max-width: 767px) {
  .reading-page {
    padding-bottom: calc(88px + env(safe-area-inset-bottom));
  }

  .mobile-switch {
    position: sticky;
    top: 0;
    z-index: var(--z-topbar);
    display: block;
    padding: var(--space-2) 0;
    margin-bottom: var(--space-3);
    background: var(--color-bg);
  }

  .mobile-switch :deep(.segmented) {
    display: grid;
    width: 100%;
  }

  .reading-layout {
    gap: 0;
  }

  /* 提交栏固定在底部，切到文章面板时必须保留；只隐藏题头与题目列表 */
  .reading-layout.show-article .panel-head,
  .reading-layout.show-article :deep(.question-list) {
    display: none;
  }

  .reading-layout.show-article .question-panel {
    padding: 0;
  }

  .reading-layout.show-questions .article-column {
    display: none;
  }

  .panel-head {
    margin-bottom: var(--space-3);
  }

  .state-card {
    margin-top: var(--space-8);
    padding: var(--space-8) var(--space-5);
  }
}
</style>
