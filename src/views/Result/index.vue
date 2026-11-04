<script setup>
/**
 * 练习结果视图
 * 只消费“已提交”的完整结果：成绩摘要、逐题解析、英文原文与中文翻译。
 * 守卫负责预载与未提交重定向；本页在直接挂载时补充加载，并处理 404 / 网络错误。
 * 安全约束：翻译、正确答案与解析只在本页出现，全部使用文本插值。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import BaseButton from '../../component/BaseButton.vue'
import GuestGate from '../../component/GuestGate.vue'
import SkeletonBlock from '../../component/SkeletonBlock.vue'
import ArticleCard from '../Reading/component/ArticleCard.vue'
import NewWordsPanel from '../Reading/component/NewWordsPanel.vue'
import UsedWordsPanel from '../Reading/component/UsedWordsPanel.vue'
import QuestionReview from './component/QuestionReview.vue'
import ScoreSummary from './component/ScoreSummary.vue'
import TranslationPanel from './component/TranslationPanel.vue'
import { useAuthGate } from '../../composables/useAuthGate'
import { hasGenerationHandoff, setGenerationHandoff } from '../../composables/useGenerationHandoff'
import { useAuthStore } from '../../stores/model/auth'
import { useReadingStore } from '../../stores/model/reading'
import { formatDateTime } from '../../unit/format'

const route = useRoute()
const router = useRouter()
const store = useReadingStore()
const auth = useAuthStore()
const { goLogin } = useAuthGate()
// 「再练一次」不发请求：只把同一组参数交给生成页，动画与请求都在 /generating 完成（md/55 §5.1）
const retrying = ref(false)
// 结果含答案与翻译，只属于账号数据：游客不请求，整页换成登录引导（md/45 §5.7）
const isGuest = computed(() => !auth.isAuthenticated)

const readingId = computed(() => String(route.params.id ?? '').trim())

// 只允许当前路由对应的已提交结果进入渲染，避免切换阅读时闪出上一条数据
const result = computed(() => {
  const data = store.result
  if (!data || String(data.id) !== readingId.value) return null
  return data
})

const loadError = computed(() => store.loadError)
const hasReadingId = computed(() => Boolean(readingId.value))
const isLoading = computed(() => hasReadingId.value && !result.value && !loadError.value)
const isNotFound = computed(
  () => !hasReadingId.value || loadError.value?.code === 'READING_NOT_FOUND',
)

const errorTitle = computed(() => (isNotFound.value ? '这篇练习不存在或已被删除' : '结果加载失败'))
const errorDescription = computed(() =>
  isNotFound.value
    ? '可以回到历史记录，查看其他练习。'
    : loadError.value?.message || '网络出了点问题，请稍后重试。',
)

// 逐段中文翻译：与 article 段落一一对应。为空时退回旧的整段翻译面板，
// 保证 2026-11 之前生成、没有 translations 的老文章仍能看到中文。
const inlineTranslations = computed(() => {
  const list = result.value?.translations
  return Array.isArray(list) && list.length ? list : []
})

const reviewItems = computed(() => {
  const data = result.value
  if (!data) return []

  const questions = data.questions?.length ? data.questions : store.reading?.questions || []
  const questionMap = new Map(questions.map((question) => [question.id, question]))

  return (data.results || [])
    .map((item) => ({ result: item, question: questionMap.get(item.questionId) }))
    .filter((item) => item.question)
})

async function loadResult() {
  if (isGuest.value) return

  const id = readingId.value
  if (!id || result.value || store.loadError) return

  const outcome = await store.ensureReading(id)
  if (outcome?.submitted === false) {
    router.replace({ name: 'reading', params: { id } })
  }
}

onMounted(loadResult)

watch(readingId, (id, previous) => {
  if (isGuest.value || !id || id === previous) return
  loadResult()
})

async function retryLoad() {
  if (isGuest.value) return

  const id = readingId.value
  if (!id) return

  const outcome = await store.ensureReading(id, { force: true })
  if (outcome?.submitted === false) {
    router.replace({ name: 'reading', params: { id } })
  }
}

function retryPractice() {
  const current = result.value
  if (!current || retrying.value) return

  // 交接单还没被取走说明上一次跳转仍在路上，不覆盖，避免连点发两次生成
  if (!hasGenerationHandoff()) {
    setGenerationHandoff(
      {
        level: current.level,
        targetWords: current.targetWords,
        questionCount: current.questionCount,
      },
      { from: route.fullPath },
    )
  }
  retrying.value = true
  router.push('/generating')
}

function goHistory() {
  router.push('/history')
}

function goHome() {
  router.push('/')
}
</script>

<template>
  <section class="result-page">
    <GuestGate v-if="isGuest" title="请登录后查看练习结果" @login="goLogin(route.fullPath)" />

    <div v-else-if="isLoading" class="result-skeleton" role="status" aria-label="正在加载练习结果">
      <SkeletonBlock width="120px" height="14px" />
      <SkeletonBlock width="220px" height="34px" radius="var(--radius-sm)" />
      <SkeletonBlock height="140px" radius="var(--radius-xl)" />
      <div class="skeleton-grid">
        <div class="skeleton-column">
          <SkeletonBlock height="320px" radius="var(--radius-xl)" />
          <SkeletonBlock height="120px" radius="var(--radius-md)" />
          <SkeletonBlock height="180px" radius="var(--radius-xl)" />
        </div>
        <div class="skeleton-column">
          <SkeletonBlock height="110px" radius="var(--radius-md)" />
          <SkeletonBlock height="110px" radius="var(--radius-md)" />
          <SkeletonBlock height="110px" radius="var(--radius-md)" />
        </div>
      </div>
    </div>

    <div v-else-if="loadError || !hasReadingId" class="state-card" role="alert">
      <h1 class="state-title">{{ errorTitle }}</h1>
      <p class="state-desc">{{ errorDescription }}</p>
      <p v-if="loadError?.requestId" class="state-id">错误编号：{{ loadError.requestId }}</p>
      <BaseButton v-if="isNotFound" @click="goHistory">返回历史</BaseButton>
      <BaseButton v-else variant="secondary" :loading="store.loading" @click="retryLoad">
        重新加载
      </BaseButton>
    </div>

    <template v-else-if="result">
      <header class="result-header">
        <button type="button" class="back-link" aria-label="返回历史记录" @click="goHistory">
          <ArrowLeft :size="16" aria-hidden="true" />
          <span>返回历史</span>
        </button>
        <h1 class="result-title">练习结果</h1>
        <p class="result-time">
          提交于 {{ formatDateTime(result.submittedAt) }}
          <template v-if="result.tokenUsage?.totalTokens">
            · 本次生成消耗 {{ result.tokenUsage.totalTokens }} tokens
          </template>
        </p>
      </header>

      <ScoreSummary
        :score="result.score"
        :correct-count="result.correctCount"
        :total-questions="result.totalQuestions"
        :retrying="retrying"
        @retry="retryPractice"
        @home="goHome"
        @history="goHistory"
      />

      <div class="result-layout">
        <div class="article-area">
          <ArticleCard
            :title="result.title"
            :article="result.article"
            :word-count="result.actualWords"
            :translations="inlineTranslations"
            title-tag="h2"
          >
            <template #translation>
              <TranslationPanel
                v-if="!inlineTranslations.length"
                variant="embedded"
                title-tag="h3"
                :translation="result.translation"
              />
            </template>
          </ArticleCard>
          <NewWordsPanel :words="result.newWords" />
          <UsedWordsPanel :words="result.usedWords" clickable />
        </div>

        <section class="review-area" aria-labelledby="review-title">
          <div class="review-head">
            <h2 id="review-title" class="review-title">题目解析</h2>
            <span class="review-count"
              >答对 {{ result.correctCount }} / {{ result.totalQuestions }}</span
            >
          </div>

          <ol class="review-list">
            <QuestionReview
              v-for="(item, index) in reviewItems"
              :key="item.result.questionId"
              :question="item.question"
              :result="item.result"
              :index="index"
            />
          </ol>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.result-page {
  width: 100%;
}

.result-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-8);
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: var(--space-1) 0;
  border: none;
  background: none;
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  transition: color var(--dur-fast) var(--ease-out);
}

.back-link:hover {
  color: var(--color-ink);
}

.result-title {
  font-family: var(--font-display);
  font-size: var(--text-page-title);
  font-weight: 400;
  line-height: var(--leading-page-title);
  letter-spacing: 0.02em;
}

.result-time {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.result-layout {
  display: grid;
  grid-template-areas: 'article review';
  grid-template-columns: minmax(0, 58fr) minmax(0, 42fr);
  align-items: start;
  gap: 28px;
  margin-top: 28px;
}

.article-area {
  grid-area: article;
  min-width: 0;
}

.review-area {
  grid-area: review;
  min-width: 0;
}

.review-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.review-title {
  font-family: var(--font-display);
  font-size: var(--text-section);
  line-height: var(--leading-section);
  letter-spacing: 0.02em;
}

.review-count {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  white-space: nowrap;
}

.review-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: 0;
  margin: 0;
  list-style: none;
}

.result-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.skeleton-grid {
  display: grid;
  grid-template-columns: minmax(0, 58fr) minmax(0, 42fr);
  gap: 28px;
}

.skeleton-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
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

@media (max-width: 1023px) {
  .result-layout {
    grid-template-areas:
      'review'
      'article';
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-6);
    margin-top: var(--space-6);
  }

  .skeleton-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 767px) {
  .result-header {
    margin-bottom: var(--space-6);
  }

  .review-list {
    gap: var(--space-2);
  }

  .state-card {
    margin-top: var(--space-8);
    padding: var(--space-8) var(--space-5);
  }
}
</style>
