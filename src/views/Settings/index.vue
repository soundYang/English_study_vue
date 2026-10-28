<script setup>
/**
 * 阅读设置视图
 * 难度整卡、文章长度步进器、题目数量分段控件；保存到 localStorage 并启动生成。
 * 生成失败、取消与重试统一由全局 GenerateOverlay 处理。
 */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../../component/BaseButton.vue'
import DifficultyPicker from './component/DifficultyPicker.vue'
import LengthPicker from './component/LengthPicker.vue'
import QuestionCountPicker from './component/QuestionCountPicker.vue'
import SettingsAside from './component/SettingsAside.vue'
import { useCapacity } from '../../composables/useCapacity'
import { useGenerateReading } from '../../composables/useGenerateReading'
import { useToast } from '../../composables/useToast'
import { useSettingsStore } from '../../stores/model/settings'
import { firstError, LEVEL_MAX_TARGET_WORDS, TARGET_WORDS_MAX } from '../../unit/validators'

const LEVEL_LABELS = { easy: '简单', medium: '进阶', hard: '挑战' }

const router = useRouter()
const toast = useToast()
const settings = useSettingsStore()
const { isGenerating, start } = useGenerateReading()
const {
  capacity,
  loading: capacityLoading,
  error: capacityError,
  load: loadCapacity,
  levelGate: gateOf,
  maxTargetWords: maxOf,
  dispose: disposeCapacity,
} = useCapacity()

const draft = reactive({
  level: settings.level,
  targetWords: settings.targetWords,
  questionCount: settings.questionCount,
})

const saving = ref(false)

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

const gate = computed(() => gateOf(draft.level))
const levelLabel = computed(() => LEVEL_LABELS[draft.level] || '当前难度')
// 「基于你的 N 个单词」与覆盖层重试都用它；删掉 fetchWords 之后这是唯一来源
const availableWords = computed(() => capacity.value?.available ?? null)
// 上限以预检为准，回来之前用静态副本兜底，避免控件在上限未知时放开到 600
const lengthMax = computed(
  () => maxOf(draft.level) || LEVEL_MAX_TARGET_WORDS[draft.level] || TARGET_WORDS_MAX,
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

// 切换难度后篇幅可能超出新上限：向下夹住，而不是等用户点生成才 400
watch(lengthMax, (max) => {
  if (draft.targetWords > max) draft.targetWords = max
})

// 难度或篇幅一变就重预检：一个接口同时回答「这个难度认识词够不够」和「这个篇幅凑不凑得齐」
watch(
  () => [draft.level, draft.targetWords],
  ([, targetWords]) => loadCapacity({ targetWords }),
  { immediate: true },
)

onBeforeUnmount(disposeCapacity)

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
            <LengthPicker v-model="draft.targetWords" :max="lengthMax" :disabled="isGenerating" />
            <QuestionCountPicker v-model="draft.questionCount" :disabled="isGenerating" />
          </div>

          <!-- 预检是防抖的：加载中说明这一块还是上一次参数的结果，弱化而不是清空 -->
          <div
            class="capacity-note"
            :class="{ 'is-stale': capacityLoading }"
            role="status"
            aria-live="polite"
          >
            <p v-if="capacityError" class="capacity-warn">{{ capacityError }}</p>
            <p v-else-if="capacityLoading && !gate" class="capacity-idle">正在检查当前词库…</p>
            <template v-else-if="gate">
              <p v-if="!gate.knownSufficient" class="capacity-warn">
                {{ levelLabel }}需要认识约 {{ gate.requiredKnown }} 个单词，当前
                {{ gate.knownWords }} 个，还差 {{ gate.knownShortage }} 个。
              </p>
              <p v-else-if="!gate.sufficient" class="capacity-warn">
                这个篇幅还差 {{ gate.shortage }} 个可用词，建议缩短文章。
              </p>
              <p v-else class="capacity-ok">
                当前难度可写 {{ gate.maxTargetWords }} 词以内，参数可用。
              </p>
            </template>
          </div>
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

/* 左表单列 + 右满高装饰列；装饰列右侧留白，见 meta.flush */
.settings-page {
  /* 页面两端统一的留白基准：左表单列和右装饰列都从这里起步，见 SettingsAside */
  --settings-gutter: calc(var(--content-pad-x) + var(--space-10));

  display: grid;
  /* 左表单 : 右插画 = 7 : 3；插画列多分一成，整幅插画随之左移 */
  grid-template-columns: minmax(0, 7fr) minmax(0, 3fr);
  min-height: calc(100dvh - var(--topbar-height));
}

.settings-main {
  width: 100%;
  /* 上限 1200px 指的是正文宽度，左右内边距要另加，比例在 1920 这类宽屏下仍成立 */
  max-width: calc(1200px + var(--settings-gutter) + var(--space-10));
  padding: var(--content-pad-y) var(--space-10) var(--space-12) var(--settings-gutter);
}

.settings-form {
  min-width: 0;
  margin-top: var(--space-6);
  animation: settings-rise var(--dur-page) var(--ease-out) 60ms both;
}

.section-title {
  font-family: var(--font-display);
  font-size: var(--text-section);
  line-height: var(--leading-section);
  letter-spacing: 0.02em;
}

.params {
  margin-top: var(--space-6);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-line);
}

.params-table {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  margin-top: var(--space-4);
}

.capacity-note {
  margin-top: var(--space-4);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.capacity-note.is-stale {
  opacity: 0.55;
}

.capacity-warn {
  color: var(--color-warning);
}

.actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-8);
  padding-top: var(--space-5);
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
    max-width: none;
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
