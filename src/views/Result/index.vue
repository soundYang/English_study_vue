<script setup>
/**
 * 练习结果视图
 * 只消费“已提交”的完整结果：成绩摘要、逐题解析、英文原文与中文翻译。
 * 守卫负责预载与未提交重定向；本页在直接挂载时补充加载，并处理 404 / 网络错误。
 * 安全约束：翻译、正确答案与解析只在本页出现，全部使用文本插值。
 */
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import BaseButton from '../../component/BaseButton.vue'
import SkeletonBlock from '../../component/SkeletonBlock.vue'
import ArticleCard from '../Reading/component/ArticleCard.vue'
import QuestionReview from './component/QuestionReview.vue'
import ScoreSummary from './component/ScoreSummary.vue'
import TranslationPanel from './component/TranslationPanel.vue'
import { useGenerateReading } from '../../composables/useGenerateReading'
import { useReadingStore } from '../../stores/model/reading'
import { formatDateTime } from '../../unit/format'

const route = useRoute()
const router = useRouter()
const store = useReadingStore()
const { isGenerating, start } = useGenerateReading()

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
  const id = readingId.value
  if (!id || result.value || store.loadError) return

  const outcome = await store.ensureReading(id)
  if (outcome?.submitted === false) {
    router.replace({ name: 'reading', params: { id } })
  }
}

onMounted(loadResult)

watch(readingId, (id, previous) => {
  if (!id || id === previous) return
  loadResult()
})

async function retryLoad() {
  const id = readingId.value
  if (!id) return

  const outcome = await store.ensureReading(id, { force: true })
  if (outcome?.submitted === false) {
    router.replace({ name: 'reading', params: { id } })
  }
}

async function retryPractice() {
  const current = result.value
  if (!current || isGenerating.value) return

  const generated = await start({
    level: current.level,
    targetWords: current.targetWords,
    questionCount: current.questionCount,
  })

  if (generated) router.push(`/readings/${generated.id}`)
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
    <div v-if="isLoading" class="result-skeleton" role="status" aria-label="正在加载练习结果">
      <SkeletonBlock width="120px" height="14px" />
      <SkeletonBlock width="220px" height="34px" radius="var(--radius-sm)" />
      <SkeletonBlock height="140px" radius="var(--radius-xl)" />
      <div class="skeleton-grid">
        <div class="skeleton-column">
          <SkeletonBlock height="320px" radius="var(--radius-xl)" />
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
      <p class="state-title">{{ errorTitle }}</p>
      <p class="state-desc">{{ errorDescription }}</p>
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
        <p class="result-time">提交于 {{ formatDateTime(result.submittedAt) }}</p>
      </header>

      <ScoreSummary
        :score="result.score"
        :correct-count="result.correctCount"
        :total-questions="result.totalQuestions"
        :retrying="isGenerating"
        @retry="retryPractice"
        @home="goHome"
        @history="goHistory"
      />

      <div class="result-layout">
        <div class="article-area">
          <ArticleCard :title="result.title" :article="result.article" title-tag="h2" />
        </div>

        <TranslationPanel class="translation-area" :translation="result.translation" />

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
  grid-template-areas:
    'article review'
    'translation review';
  grid-template-columns: minmax(0, 58fr) minmax(0, 42fr);
  align-items: start;
  gap: 28px;
  margin-top: 28px;
}

.article-area {
  grid-area: article;
  min-width: 0;
}

.translation-area {
  grid-area: translation;
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

@media (max-width: 1023px) {
  .result-layout {
    grid-template-areas:
      'review'
      'article'
      'translation';
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
