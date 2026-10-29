<script setup>
/**
 * 阅读设置视图
 * 难度整卡、文章长度步进器、题目数量分段控件、生词容忍开关；
 * 保存到 localStorage 后交给 /generating 生成。
 * 生成失败、取消与重试统一由全局 GenerateOverlay 处理。
 */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../../component/BaseButton.vue'
import AllowNewWordsPicker from './component/AllowNewWordsPicker.vue'
import DifficultyPicker from './component/DifficultyPicker.vue'
import LengthPicker from './component/LengthPicker.vue'
import QuestionCountPicker from './component/QuestionCountPicker.vue'
import ScopePicker from './component/ScopePicker.vue'
import SettingsAside from './component/SettingsAside.vue'
import { useAuthGate } from '../../composables/useAuthGate'
import { useCapacity } from '../../composables/useCapacity'
import { useGenerateReading } from '../../composables/useGenerateReading'
import { hasGenerationHandoff, setGenerationHandoff } from '../../composables/useGenerationHandoff'
import { useQuota } from '../../composables/useQuota'
import { useToast } from '../../composables/useToast'
import { useAuthStore } from '../../stores/model/auth'
import { useSettingsStore } from '../../stores/model/settings'
import { capacityNoteOf } from '../../unit/capacity'
import { firstError, LEVEL_MAX_TARGET_WORDS, TARGET_WORDS_MAX } from '../../unit/validators'

const LEVEL_LABELS = { easy: '简单', medium: '进阶', hard: '挑战' }

const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const settings = useSettingsStore()
const { requireAuth } = useAuthGate()
const { isGenerating } = useGenerateReading()
const isGuest = computed(() => !auth.isAuthenticated)
const {
  capacity,
  loading: capacityLoading,
  error: capacityError,
  load: loadCapacity,
  levelGate: gateOf,
  maxTargetWords: maxOf,
  dispose: disposeCapacity,
} = useCapacity({ enabled: () => auth.isAuthenticated })
// 额度用尽时禁用「开始生成」；查询失败不拦（useQuota fail-open），交给后端 429 兜底。
// 游客不发额度请求，也不显示上一个账号的剩余次数（md/45 §5.4）
const { quotaNote, isBlocked: quotaBlocked } = useQuota({
  enabled: () => auth.isAuthenticated,
})

const draft = reactive({
  level: settings.level,
  targetWords: settings.targetWords,
  questionCount: settings.questionCount,
  vocabScope: [...settings.vocabScope],
  // null = 自动（最终模式默认开、其余关）；用户点过开关才变成显式 true / false
  allowNewWords: settings.allowNewWords,
})

const saving = ref(false)

/** 数组逐项比较：词源是两个以上值时，引用比较会把「没改」误判成改动 */
function sameScope(left, right) {
  return [...left].sort().join(',') === [...right].sort().join(',')
}

const isDirty = computed(
  () =>
    draft.level !== settings.level ||
    draft.targetWords !== settings.targetWords ||
    draft.questionCount !== settings.questionCount ||
    !sameScope(draft.vocabScope, settings.vocabScope) ||
    // null（自动）与 false（显式关）语义不同，不能用真假判断
    draft.allowNewWords !== settings.allowNewWords,
)

// 首次进入时允许直接保存默认值；之后有改动才可再次保存
const canSave = computed(
  () => (!settings.hasSavedSettings || isDirty.value) && !isGenerating.value && !saving.value,
)

const gate = computed(() => gateOf(draft.level))
const levelLabel = computed(() => LEVEL_LABELS[draft.level] || '当前难度')
// 「基于你的 N 个单词」与覆盖层重试都用它；各档池子不是同一个数，
// 顶层 available 只是 hard 的口径，必须读当前难度的（后端 md/22 §3）
const availableWords = computed(() => capacity.value?.levels?.[draft.level]?.available ?? null)
// 上限以预检为准，回来之前用静态副本兜底，避免控件在上限未知时放开到 600
const lengthMax = computed(
  () => maxOf(draft.level) || LEVEL_MAX_TARGET_WORDS[draft.level] || TARGET_WORDS_MAX,
)
// 最终模式只挂在 hard 上（不是第四档难度）；预检回来之前不画灰区，避免闪一下又收回。
// maxTargetWords 在顶层 finalMode 里，每档的 finalMode 只说明支不支持、解没解锁
const levelFinalMode = computed(() => {
  const mode = gateOf(draft.level)?.finalMode
  if (!mode?.supported) return null

  return {
    ...mode,
    maxTargetWords: capacity.value?.finalMode?.maxTargetWords || TARGET_WORDS_MAX,
  }
})
// 门禁解释统一在 unit/capacity.js：后端按「上限 → 已知词 → 候选池」的顺序拦截，
// 这里按同一顺序说明，避免两处各写一套判断（md/30 §7 删掉 knownSufficient 后尤其如此）
const capacityNote = computed(() =>
  capacityNoteOf(gate.value, {
    levelLabel: levelLabel.value,
    targetWords: draft.targetWords,
    wordRangeLabel: capacity.value?.wordRange?.label || '',
  }),
)
// 最终模式（hard + 篇幅 > 600 + 个人词库 ≥ 3000）下不传开关就是开启（后端 md/42）。
// 只信预检回来的 active，不自己用 targetWords / 词库数字推
const isFinalMode = computed(() => Boolean(gateOf(draft.level)?.finalMode?.active))
// 只是上限（medium 3 / hard 5），不表示这篇一定有生词；预检回来之前显示通用文案
const unknownBudget = computed(() => {
  const budget = capacity.value?.levels?.[draft.level]?.unknownBudget
  return typeof budget === 'number' ? budget : null
})

// 生成失败覆盖层里的“降低难度 / 缩短文章”会改写已保存设置（路由仍是本页），
// 这里同步回草稿，避免再次生成时把调整覆盖回去
watch(
  () => [
    settings.level,
    settings.targetWords,
    settings.questionCount,
    settings.vocabScope,
    settings.allowNewWords,
  ],
  ([level, targetWords, questionCount, vocabScope, allowNewWords]) => {
    draft.level = level
    draft.targetWords = targetWords
    draft.questionCount = questionCount
    draft.vocabScope = [...vocabScope]
    draft.allowNewWords = allowNewWords
  },
)

// 切换难度后篇幅可能超出新上限：向下夹住，而不是等用户点生成才 400
watch(lengthMax, (max) => {
  if (draft.targetWords > max) draft.targetWords = max
})

// easy 固定 0 生词、不渲染开关；从 medium / hard 切回来时把遗留的显式值清成自动，
// 否则保存后请求会带 easy + true，被后端直接 400（md/41 §3.1）
watch(
  () => draft.level,
  (level) => {
    if (level === 'easy') draft.allowNewWords = null
  },
)

// 难度、篇幅或词源一变就重预检：一个接口同时回答「这个难度认识词够不够」「这个篇幅凑不凑得齐」
// 词源收窄后候选池跟着变小，不重新预检的话，界面上还挂着上一个范围的成功结论
watch(
  () => [draft.level, draft.targetWords, draft.vocabScope.join(',')],
  ([, targetWords]) => loadCapacity({ targetWords, vocabScope: [...draft.vocabScope] }),
  { immediate: true },
)

// 游客在本页登录后补一次预检，不用刷新页面
watch(
  () => auth.isAuthenticated,
  (authenticated) => {
    if (!authenticated) return
    loadCapacity({ targetWords: draft.targetWords, vocabScope: [...draft.vocabScope] })
  },
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

function handleGenerate() {
  // 游客点开始生成才去登录，设置本身仍可本地保存（md/45 §5.4）
  if (!requireAuth(runGenerate, { redirect: '/settings' })) return
}

function runGenerate() {
  if (isGenerating.value || saving.value) return

  // 按钮已禁用；回车提交也拦住，并说明为什么，别让用户对着没反应的按钮猜
  if (quotaBlocked.value) {
    toast.info(quotaNote.value)
    return
  }
  if (!persistDraft()) return

  // 生成页负责发请求与播纸页动画；这里只保存设置、把参数交接过去。
  // 交接单还在说明上一次跳转还没被取走，不覆盖，避免连点发两次
  if (!hasGenerationHandoff()) {
    setGenerationHandoff(settings.payload, {
      availableWords: availableWords.value,
      from: '/settings',
    })
  }
  router.push('/generating')
}
</script>

<template>
  <section class="settings-page">
    <div class="settings-main">
      <header class="page-head">
        <p class="page-eyebrow">Reading Setup</p>
        <h1 class="page-title">阅读设置</h1>
        <p class="page-desc">选择难度、词源和文章参数，让 AI 生成更适合你的阅读材料。</p>
      </header>

      <form class="settings-form" @submit.prevent="handleGenerate">
        <DifficultyPicker
          v-model="draft.level"
          :gates="capacity?.levels || {}"
          :disabled="isGenerating"
        />

        <section class="scope">
          <h2 class="section-title">2. 选择词源</h2>
          <ScopePicker v-model="draft.vocabScope" class="scope-picker" :disabled="isGenerating" />
        </section>

        <section class="params">
          <h2 class="section-title">3. 设置文章参数</h2>

          <div class="params-table">
            <LengthPicker
              v-model="draft.targetWords"
              :max="lengthMax"
              :final-mode="levelFinalMode"
              :disabled="isGenerating"
            />
            <QuestionCountPicker v-model="draft.questionCount" :disabled="isGenerating" />
            <!-- easy 的 0 生词是难度承诺的一部分，不提供开关（后端收到 easy + true 会 400） -->
            <AllowNewWordsPicker
              v-if="draft.level !== 'easy'"
              v-model="draft.allowNewWords"
              :budget="unknownBudget"
              :auto-on="isFinalMode"
              :disabled="isGenerating"
            />
          </div>

          <!-- 预检是防抖的：加载中说明这一块还是上一次参数的结果，弱化而不是清空 -->
          <div
            class="capacity-note"
            :class="{ 'is-stale': capacityLoading }"
            role="status"
            aria-live="polite"
          >
            <p v-if="isGuest" class="capacity-idle">登录后可检查你的词库是否够生成这篇文章</p>
            <p v-else-if="capacityError" class="capacity-warn">{{ capacityError }}</p>
            <p v-else-if="capacityLoading && !gate" class="capacity-idle">正在检查当前词库…</p>
            <template v-else-if="gate && capacityNote">
              <p :class="capacityNote.tone === 'warn' ? 'capacity-warn' : 'capacity-ok'">
                {{ capacityNote.text }}
              </p>
            </template>
          </div>
        </section>

        <!-- 额度提示放在按钮上方：移动端操作栏是 fixed，提示仍留在表单流里 -->
        <p
          v-if="quotaNote"
          class="quota-note"
          :class="{ 'is-blocked': quotaBlocked }"
          role="status"
        >
          {{ quotaNote }}
        </p>

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
            :disabled="saving || quotaBlocked"
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

.scope,
.params {
  margin-top: var(--space-6);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-line);
}

.scope-picker {
  margin-top: var(--space-4);
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

.quota-note {
  margin-top: var(--space-6);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  text-align: right;
}

.quota-note.is-blocked {
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

/* 只改透明度、不产生 transform：移动端 fixed 操作栏需要视口做包含块 */
@keyframes settings-fade {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
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
  .settings-page {
    /* 操作栏浮在页面之上，本身不占文档流：按真实高度预留底部空间，
       md 按钮 40px + 上下内边距 + 1px 上边框，避免滚到底时最后一行被盖住 */
    --settings-actions-height: calc(40px + var(--space-3) * 2 + 1px);
  }

  .settings-form {
    margin-top: var(--space-6);
    /* 操作栏是 position: fixed，而带 transform 的祖先会成为它的包含块：
       原来的 settings-rise 结束后仍保留 translateY(0)，按钮栏就会相对表单定位、
       悬浮在页面中间并盖住生词容忍。移动端改成只淡入，不产生 transform。 */
    animation: settings-fade var(--dur-page) var(--ease-out) 60ms both;
  }

  .settings-main {
    max-width: none;
    /* 正文底部至少空出「操作栏高度 + 一段呼吸间距」 */
    padding: var(--content-pad-y) var(--content-pad-x)
      calc(var(--settings-actions-height) + var(--space-6));
  }

  .quota-note {
    text-align: left;
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
