<script setup>
/**
 * 今日复习视图
 *
 * 用途：消费 `GET /api/words/daily-plan` 的到期词清单，逐个自评（通过 / 没记住），
 *       并支持「全部通过」走批量自评（md/56 P1 / P2、md/22 第 90 / 92 行）。
 * 用法：路由 /words/review（默认要求登录）
 *
 * 口径：
 *   - 进度数字全部来自后端；`doneToday` 是词次，可能包含文章里顺带复习的词，
 *     所以这里**不**拿它去反推「今天到期几个」
 *   - 本地只做点完按钮后的即时扣减，store 里刷新以后端为准
 *   - 清单最多 50 个；清空后若仍有积压，自动再拉一批
 */
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BaseButton from '../../component/BaseButton.vue'
import EmptyState from '../../component/EmptyState.vue'
import SkeletonBlock from '../../component/SkeletonBlock.vue'
import StatusPill from '../../component/StatusPill.vue'
import WordDetailPopover from '../../component/WordDetailPopover.vue'
import { useToast } from '../../composables/useToast'
import { useWordsStore } from '../../stores/model/words'
import { myWordDetail } from '../../unit/word-detail'

const store = useWordsStore()
const toast = useToast()
const router = useRouter()

// 正在提交的单条 id：同一时间只允许一个自评，避免连点把轮次推两轮
const pendingId = ref('')
const batching = ref(false)
const loadError = ref('')
// 详情浮层：{ item, anchor }，数据来自清单快照，不额外请求
const detailTarget = ref(null)

const plan = computed(() => store.dailyPlan)
const words = computed(() => plan.value?.review?.words || [])
const remaining = computed(() => Math.max(0, plan.value?.review?.remaining ?? 0))
const today = computed(() => Math.max(0, plan.value?.review?.today ?? 0))
const done = computed(() => Math.max(0, plan.value?.review?.doneToday ?? 0))
const overflow = computed(() => remaining.value > today.value)
const loading = computed(() => store.dailyPlanLoading && !plan.value)
const detailData = computed(() =>
  detailTarget.value ? myWordDetail(detailTarget.value.item) : null,
)

onMounted(load)

async function load() {
  loadError.value = ''
  const result = await store.loadDailyPlan()
  if (!result.ok) loadError.value = result.message
}

function stageText(item) {
  return `第 ${(item.reviewStage || 0) + 1} 轮`
}

function openDetail(item, event) {
  if (detailTarget.value?.item.id === item.id) {
    detailTarget.value = null
    return
  }

  detailTarget.value = { item, anchor: event.currentTarget }
}

function handleDetailOpen(value) {
  if (!value) detailTarget.value = null
}

/** 单条自评：通过 / 没记住 */
async function mark(item, result) {
  if (pendingId.value || batching.value) return

  pendingId.value = item.id
  const outcome = await store.reviewWord(item.id, result)
  pendingId.value = ''

  if (!outcome.ok) {
    // 词可能已在另一个标签页被删掉：提示一下即可，下一次刷新清单就没了
    if (outcome.code === 'WORD_NOT_FOUND') toast.info(`${item.word} 已经不在词库里了`)
    else toast.error(outcome.message)
    return
  }

  if (result === 'lapse') {
    toast.info(`明天再复习 ${item.word}`)
  } else if (outcome.item?.status === 'mastered') {
    toast.success(`已掌握 ${item.word}`)
  } else {
    toast.success(`已通过 ${item.word}`)
  }

  await refillIfNeeded()
}

/** 全部通过：一次请求处理当前清单，单项失败不拖垮整批 */
async function passAll() {
  if (batching.value || pendingId.value || !words.value.length) return

  batching.value = true
  const items = words.value.map((item) => ({ id: item.id, result: 'pass' }))
  const outcome = await store.reviewBatch(items)
  batching.value = false

  if (!outcome.ok) {
    toast.error(outcome.message)
    return
  }

  toast.success(`已通过 ${outcome.updated} 个词`)
  if (outcome.skipped?.length) {
    toast.info(`有 ${outcome.skipped.length} 个词没有处理（已删除或来自基础词表）`)
  }

  await refillIfNeeded()
}

/**
 * 清单清空但还有积压：再拉一批
 *
 * 只在动作回调里调用，不在 watch 里监听 —— 后端若返回空清单但 remaining > 0，
 * 这里最多再拉一次，不会形成请求循环；空态文案会说明「明天继续」。
 */
async function refillIfNeeded() {
  if (words.value.length || remaining.value <= 0) return
  await store.loadDailyPlan({ quiet: true })
}
</script>

<template>
  <section class="review-page">
    <header class="page-head">
      <RouterLink class="back-link" to="/words">← 返回我的单词</RouterLink>
      <p class="page-eyebrow">Review</p>
      <h1 class="page-title">今日复习</h1>
      <p class="page-desc" aria-live="polite">
        待复习 <strong class="count-accent">{{ remaining }}</strong> 个 · 今天已完成
        <strong class="count-accent">{{ done }}</strong> 次
      </p>
      <p v-if="overflow" class="page-hint">今天先复习 {{ today }} 个，剩下的顺延到明天。</p>
    </header>

    <p v-if="loading" class="sr-only" role="status">正在加载今日复习</p>

    <div v-if="loading" class="review-skeleton" aria-hidden="true">
      <SkeletonBlock v-for="index in 3" :key="index" height="92px" radius="var(--radius-lg)" />
    </div>

    <div v-else-if="loadError" class="state-card" role="alert">
      <p class="state-title">今日复习加载失败</p>
      <p class="state-desc">{{ loadError }}</p>
      <BaseButton variant="secondary" @click="load">重试</BaseButton>
    </div>

    <template v-else-if="words.length">
      <div class="list-head">
        <h2 class="list-title">到期单词（{{ words.length }}）</h2>
        <BaseButton variant="secondary" :loading="batching" @click="passAll">全部通过</BaseButton>
      </div>

      <ul class="review-list">
        <li v-for="item in words" :key="item.id" class="review-row">
          <div class="word-block">
            <div class="word-line">
              <button
                type="button"
                class="word-text"
                aria-haspopup="dialog"
                :aria-expanded="detailTarget?.item.id === item.id ? 'true' : 'false'"
                :aria-label="`查看 ${item.word} 的详细信息`"
                @click="openDetail(item, $event)"
              >
                {{ item.word }}
              </button>
              <span class="round-tag">{{ stageText(item) }}</span>
            </div>
            <p class="word-summary">{{ item.summary || '—' }}</p>
          </div>

          <div class="row-actions">
            <BaseButton
              variant="secondary"
              :disabled="Boolean(pendingId) || batching"
              :aria-label="`${item.word} 没记住`"
              @click="mark(item, 'lapse')"
            >
              没记住
            </BaseButton>
            <BaseButton
              :loading="pendingId === item.id"
              :disabled="(Boolean(pendingId) && pendingId !== item.id) || batching"
              :aria-label="`${item.word} 通过`"
              @click="mark(item, 'pass')"
            >
              通过
            </BaseButton>
          </div>
        </li>
      </ul>
    </template>

    <EmptyState
      v-else
      title="今天的复习完成了"
      :description="
        remaining > 0
          ? `还有 ${remaining} 个词待复习，明天继续。`
          : '今天没有要复习的单词，明天再来吧。'
      "
    >
      <template #actions>
        <BaseButton variant="secondary" @click="router.push('/words')">返回我的单词</BaseButton>
      </template>
    </EmptyState>

    <WordDetailPopover
      :open="Boolean(detailTarget)"
      :anchor="detailTarget?.anchor || null"
      :word="detailData?.word || ''"
      :phonetic="detailData?.phonetic || null"
      :senses="detailData?.senses || []"
      :facts="detailData?.facts || []"
      @update:open="handleDetailOpen"
    >
      <template #badges>
        <StatusPill
          v-if="detailTarget"
          kind="status"
          :value="detailTarget.item.studyState"
          :stage="detailTarget.item.reviewStage || 0"
        />
      </template>
    </WordDetailPopover>
  </section>
</template>

<style scoped>
.review-page {
  width: 100%;
}

.page-head {
  animation: review-rise var(--dur-page) var(--ease-out) both;
}

.back-link {
  display: inline-block;
  margin-bottom: var(--space-3);
  color: var(--color-muted);
  font-size: var(--text-small);
  text-decoration: none;
}

.back-link:hover {
  color: var(--color-ink);
}

.count-accent {
  color: var(--color-accent);
  font-family: var(--font-display);
  font-weight: 500;
}

.page-hint {
  margin-top: var(--space-2);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.review-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-6);
}

.state-card {
  margin-top: var(--space-8);
  padding: var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  text-align: center;
}

.state-title {
  font-size: var(--text-card-title);
  font-weight: 500;
}

.state-desc {
  margin: var(--space-2) 0 var(--space-4);
  color: var(--color-muted);
  font-size: var(--text-small);
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-6);
}

.list-title {
  font-size: var(--text-card-title);
  font-weight: 500;
}

.review-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding: 0;
  list-style: none;
}

.review-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  animation: review-rise var(--dur-page) var(--ease-out) both;
}

.word-block {
  min-width: 0;
}

.word-line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* 单词本身是详情入口：去掉按钮默认外观，保留正文排版 */
.word-text {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 500;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease-out);
}

.word-text:hover {
  color: var(--color-accent);
  text-decoration-color: currentColor;
}

.round-tag {
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--color-bg-deep);
  color: var(--color-muted);
  font-size: var(--text-caption);
  white-space: nowrap;
}

.word-summary {
  margin-top: 4px;
  overflow: hidden;
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  flex-shrink: 0;
  gap: var(--space-2);
}

@keyframes review-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 767px) {
  .review-row {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .word-block {
    width: 100%;
  }

  .row-actions {
    width: 100%;
  }

  .row-actions :deep(.base-button) {
    flex: 1;
  }
}
</style>
