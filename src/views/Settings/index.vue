<script setup>
/**
 * 阅读设置视图
 * 难度整卡、文章长度步进器、题目数量分段控件；保存到 localStorage 并启动生成。
 * 生成失败、取消与重试统一由全局 GenerateOverlay 处理。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../../component/BaseButton.vue'
import DifficultyPicker from './component/DifficultyPicker.vue'
import LengthPicker from './component/LengthPicker.vue'
import QuestionCountPicker from './component/QuestionCountPicker.vue'
import SettingsAside from './component/SettingsAside.vue'
import { fetchWords } from '../../api/words'
import { useGenerateReading } from '../../composables/useGenerateReading'
import { useToast } from '../../composables/useToast'
import { useSettingsStore } from '../../stores/model/settings'
import { firstError, VOCABULARY_THRESHOLD } from '../../unit/validators'

const router = useRouter()
const toast = useToast()
const settings = useSettingsStore()
const { isGenerating, start } = useGenerateReading()

const draft = reactive({
  level: settings.level,
  targetWords: settings.targetWords,
  questionCount: settings.questionCount,
})

const saving = ref(false)
const availableWords = ref(null)

const isDirty = computed(
  () =>
    draft.level !== settings.level ||
    draft.targetWords !== settings.targetWords ||
    draft.questionCount !== settings.questionCount,
)

// 首次进入时允许直接保存默认值；之后有改动才可再次保存
const canSave = computed(
  () => (!settings.hasSavedSettings || isDirty.value) && !isGenerating.value && !saving.value,
)

const showVocabHint = computed(
  () => availableWords.value !== null && availableWords.value < VOCABULARY_THRESHOLD,
)

// 生成失败覆盖层里的“降低难度 / 缩短文章”会改写已保存设置（路由仍是本页），
// 这里同步回草稿，避免再次生成时把调整覆盖回去
watch(
  () => [settings.level, settings.targetWords, settings.questionCount],
  ([level, targetWords, questionCount]) => {
    draft.level = level
    draft.targetWords = targetWords
    draft.questionCount = questionCount
  },
)

onMounted(async () => {
  try {
    const result = await fetchWords({ page: 1, pageSize: 1 })
    availableWords.value = result.counts.learning + result.counts.mastered
  } catch {
    availableWords.value = null
  }
})

function persistDraft() {
  const result = settings.save({ ...draft })
  if (!result.valid) {
    toast.error(firstError(result.errors).message)
    return false
  }
  return true
}

async function handleSave() {
  if (saving.value || isGenerating.value) return
  if (!persistDraft()) return

  // 200ms 的最小反馈时间，避免 Toast 与按钮状态一闪而过
  saving.value = true
  await new Promise((resolve) => setTimeout(resolve, 200))
  saving.value = false
  toast.success('设置已保存')
}

async function handleGenerate() {
  if (isGenerating.value || saving.value) return
  if (!persistDraft()) return

  const generated = await start(settings.payload, { availableWords: availableWords.value })
  if (generated) router.push(`/readings/${generated.id}`)
}
</script>

<template>
  <section class="settings-page">
    <div class="settings-main">
      <header class="page-head">
        <p class="page-eyebrow">Reading Setup</p>
        <h1 class="page-title">阅读设置</h1>
        <p class="page-desc">选择你想要的难度和文章参数，让 AI 生成更适合你的阅读材料。</p>
      </header>

      <form class="settings-form" @submit.prevent="handleGenerate">
        <DifficultyPicker v-model="draft.level" :disabled="isGenerating" />

        <section class="params">
          <h2 class="section-title">2. 设置文章参数</h2>

          <div class="params-table">
            <LengthPicker v-model="draft.targetWords" :disabled="isGenerating" />
            <QuestionCountPicker v-model="draft.questionCount" :disabled="isGenerating" />
          </div>

          <p v-if="showVocabHint" class="vocab-hint">
            当前可用词汇较少，建议先添加更多单词或选择更短的文章。
          </p>
        </section>

        <div class="actions">
          <BaseButton
            class="action-button"
            variant="secondary"
            :disabled="!canSave"
            :loading="saving"
            @click="handleSave"
          >
            保存设置
          </BaseButton>
          <BaseButton
            class="action-button"
            type="submit"
            :loading="isGenerating"
            :disabled="saving"
          >
            开始生成
          </BaseButton>
        </div>
      </form>
    </div>

    <SettingsAside class="settings-aside" />
  </section>
</template>

<style scoped>
.page-head {
  animation: settings-rise var(--dur-page) var(--ease-out) both;
}

/* 左表单列 + 右满高装饰列；装饰列贴住内容区右边缘，见 meta.flush */
.settings-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(280px, 23vw, 360px);
  min-height: calc(100dvh - var(--topbar-height));
}

.settings-main {
  width: 100%;
  max-width: calc(720px + var(--content-pad-x) + var(--space-10));
  padding: var(--content-pad-y) var(--space-10) var(--space-16) var(--content-pad-x);
}

.settings-form {
  min-width: 0;
  margin-top: var(--space-8);
  animation: settings-rise var(--dur-page) var(--ease-out) 60ms both;
}

.section-title {
  font-family: var(--font-display);
  font-size: var(--text-section);
  line-height: var(--leading-section);
  letter-spacing: 0.02em;
}

.params {
  margin-top: var(--space-8);
  padding-top: var(--space-6);
  border-top: 1px solid var(--color-line);
}

.params-table {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  margin-top: var(--space-4);
}

.vocab-hint {
  margin-top: var(--space-4);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-warning-bg);
  color: var(--color-warning);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-10);
  padding-top: var(--space-6);
  border-top: 1px dashed var(--color-line-strong);
}

.settings-aside {
  animation: settings-rise var(--dur-page) var(--ease-out) 60ms both;
}

@keyframes settings-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1099px) {
  .settings-page {
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;
  }

  .settings-main {
    max-width: calc(720px + var(--content-pad-x) * 2);
  }

  .settings-aside {
    display: none;
  }
}

@media (max-width: 767px) {
  .settings-form {
    margin-top: var(--space-6);
  }

  .settings-main {
    max-width: none;
    padding: var(--content-pad-y) var(--content-pad-x) calc(72px + var(--space-6));
  }

  .actions {
    position: fixed;
    right: 0;
    bottom: calc(var(--mobile-tabbar-height) + env(safe-area-inset-bottom));
    left: 0;
    z-index: var(--z-topbar);
    margin: 0;
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--color-line);
    background: var(--color-surface);
  }

  .actions .action-button {
    flex: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-head,
  .settings-form,
  .settings-aside {
    animation-delay: 0ms !important;
  }
}
</style>
