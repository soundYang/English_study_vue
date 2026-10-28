<script setup>
/**
 * 生成纸页
 *
 * 用途：/generating 页里那张「正在成形」的纸页，负责入场、等待循环、逐段点亮与
 *       成功 / 失败 / 取消过渡。组件只认 stage 与任务快照，不读 store、不发请求。
 * 用法：<PaperStage :stage="stage" :summary="summary" :progress="progress"
 *                   :selected-words="words" :cancelling="cancelling"
 *                   :skip-entrance="resumed" @cancel="..." @back="..." />
 *
 * props:
 *   stage         ('waiting' | 'reviewing' | 'fetching' | 'done' | 'failed' | 'cancelled')
 *                 waiting 覆盖 creating / queued / planning / generating；
 *                 reviewing 覆盖 checking / saving（文案按前端口径只分三段）
 *   summary       ({ level, targetWords }) — 副标题里的难度与篇幅
 *   progress      ({ done, total })        — 后端真实段数；total 为 0 时不画格子
 *   selectedWords (Array)                  — planning 之后抽到的词，逐个入场
 *   cancelling    (Boolean)                — 取消请求在飞行中
 *   skipEntrance  (Boolean)                — 刷新恢复时直接以运行态出现，不重播入场
 * emits:
 *   cancel — 等待中点了「取消生成」
 *   back   — 失败 / 取消后点了「返回设置」
 *
 * 动效遵循 `ai生成动画方案.docx`：入场只播一次；等待只做暖光 / 墨迹 / 叶片三层轻循环，
 * 不伪造进度（不换算百分比）；卸载时 kill 全部时间线并 revert 样式。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Leaf } from 'lucide-vue-next'
import { gsap } from 'gsap'
import BaseButton from '../../../component/BaseButton.vue'

const LEVEL_LABELS = { easy: '简单', medium: '进阶', hard: '挑战' }
// 会持续展示循环的三种「还在跑」状态
const WORKING_STAGES = ['waiting', 'reviewing', 'fetching']

const COPY = {
  waiting: {
    eyebrow: 'YOUR NEXT READING',
    title: '一篇新的阅读，正在准备',
    desc: '让词汇慢慢连接成故事。',
    hint: '正在为你写下一段新的阅读……',
  },
  reviewing: {
    eyebrow: 'YOUR NEXT READING',
    title: '一篇新的阅读，正在准备',
    desc: '让词汇慢慢连接成故事。',
    hint: '正在校对这一次的稿子……',
  },
  fetching: {
    eyebrow: 'YOUR NEXT READING',
    title: '文章已经成形',
    desc: '正在为你整理这一页。',
    hint: '文章已经成形，正在为你整理页面……',
  },
  done: {
    eyebrow: 'YOUR NEXT READING',
    title: '新的阅读，准备好了',
    desc: '正在打开这一页。',
    hint: '文章已经成形，马上进入阅读。',
  },
  failed: {
    eyebrow: 'YOUR NEXT READING',
    title: '这次没能顺利完成',
    desc: '再试一次，会从上次中断的地方继续。',
    hint: '这次生成没有完成。',
  },
  cancelled: {
    eyebrow: 'YOUR NEXT READING',
    title: '已暂停这次阅读准备',
    desc: '已经写好的部分会保留。',
    hint: '随时可以回来继续。',
  },
}

const props = defineProps({
  stage: { type: String, default: 'waiting' },
  summary: { type: Object, default: () => ({}) },
  progress: { type: Object, default: () => ({ done: 0, total: 0 }) },
  selectedWords: { type: Array, default: () => [] },
  cancelling: { type: Boolean, default: false },
  skipEntrance: { type: Boolean, default: false },
})

const emit = defineEmits(['cancel', 'back'])

const paper = ref(null)
const light = ref(null)
const leaf = ref(null)
const heading = ref(null)
const skeleton = ref(null)

const copy = computed(() => COPY[props.stage] || COPY.waiting)
const isWorking = computed(() => WORKING_STAGES.includes(props.stage))

const metaText = computed(() => {
  const parts = []
  const level = LEVEL_LABELS[props.summary?.level]
  const targetWords = Number(props.summary?.targetWords)

  if (level) parts.push(`难度：${level}`)
  if (Number.isFinite(targetWords) && targetWords > 0) parts.push(`约 ${targetWords} 词`)

  return parts.join(' · ')
})

// 段数是真实计数，不是百分比：段与段词数不同，5/10 不等于写了一半篇幅
const segmentTotal = computed(() => Math.max(0, Math.floor(Number(props.progress?.total) || 0)))
const segmentDone = computed(() =>
  Math.min(segmentTotal.value, Math.max(0, Math.floor(Number(props.progress?.done) || 0))),
)
const progressText = computed(() =>
  segmentTotal.value > 0 ? `已写 ${segmentDone.value} / ${segmentTotal.value} 段` : '',
)
const showProgress = computed(() => segmentTotal.value > 0 && props.stage !== 'done')
const wordChips = computed(() =>
  props.selectedWords
    .map((item) => (typeof item === 'string' ? item : item?.word))
    .filter(Boolean)
    .slice(0, 8),
)

// 系统开了「减少动态效果」时只保留静态纸页，连等待循环也不起
const reduceMotion =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

let ctx = null
let entrance = null
let transition = null
let stageWatcher = null
let loops = []
let entered = false
let skipNext = props.skipEntrance

function stopEntrance() {
  entrance?.kill()
  entrance = null
}

function stopWaiting() {
  loops.forEach((tween) => tween.kill())
  loops = []
}

function stopTransition() {
  transition?.kill()
  transition = null
}

/** 等待循环：只动暖光、墨迹和叶片，周期各自独立，不表示生成进度 */
function playWaiting() {
  if (reduceMotion || !paper.value) return

  stopWaiting()
  loops = [
    gsap.to(light.value, {
      xPercent: 5,
      yPercent: -4,
      duration: 9,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    }),
    gsap.to(skeleton.value, {
      opacity: 0.68,
      duration: 2.8,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    }),
    gsap.to(leaf.value, {
      x: 5,
      y: -4,
      rotation: 3,
      duration: 6,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    }),
  ]
}

/** 入场：纸页 → 标题 → 骨架线，约 1.1s 后接上等待循环 */
function playEntrance() {
  if (!paper.value) return

  stopEntrance()
  stopWaiting()

  if (reduceMotion) {
    gsap.set([paper.value, heading.value, skeleton.value], { autoAlpha: 1, y: 0, scale: 1 })
    return
  }

  entrance = gsap.timeline()
  entrance
    .fromTo(
      paper.value,
      { autoAlpha: 0, y: 10, scale: 0.99 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.48, ease: 'power2.out' },
    )
    .fromTo(
      heading.value,
      { autoAlpha: 0, y: 5 },
      { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' },
      '-=0.2',
    )
    .fromTo(
      skeleton.value,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.35, ease: 'power1.out' },
      '-=0.1',
    )
    .add(playWaiting)
}

/** 刷新恢复：纸页本来就在，只把循环接上，不重播入场（后端 md/32 §5） */
function playResumed() {
  stopEntrance()
  stopTransition()

  gsap.set(paper.value, { autoAlpha: 1, y: 0, scale: 1 })
  gsap.set(heading.value, { autoAlpha: 1, y: 0 })
  gsap.set(light.value, { opacity: 1 })
  gsap.set(skeleton.value, { autoAlpha: 1, opacity: 1 })
  playWaiting()
}

/** 失败后重试：把被失败态压暗的层复位，再继续等待循环 */
function resumeWaiting() {
  playResumed()
}

/** 成功：骨架线退出、标题换成「准备好了」，随后由生成页替换到阅读页 */
function playDone() {
  // 必须连 entrance 一起停：提前成功时它末尾的 .add(playWaiting) 会把循环重新拉起来
  stopEntrance()
  stopWaiting()
  stopTransition()

  gsap.set(paper.value, { autoAlpha: 1, y: 0, scale: 1 })
  gsap.set(light.value, { opacity: 0.55 })
  gsap.set(skeleton.value, { autoAlpha: 0 })

  if (reduceMotion) {
    gsap.set(heading.value, { autoAlpha: 1, y: 0 })
    return
  }

  transition = gsap.timeline()
  transition.fromTo(
    heading.value,
    { autoAlpha: 0, y: 4 },
    { autoAlpha: 1, y: 0, duration: 0.32, ease: 'power2.out' },
  )
}

/** 失败：立即停循环，纸页保持可见，错误详情交给全局覆盖层 */
function playFailed() {
  stopEntrance()
  stopWaiting()
  stopTransition()

  gsap.set(paper.value, { autoAlpha: 1, y: 0, scale: 1 })
  gsap.set(skeleton.value, { autoAlpha: 1, opacity: 0.5 })

  if (reduceMotion) {
    gsap.set(heading.value, { autoAlpha: 1, y: 0 })
    gsap.set(light.value, { opacity: 0.35 })
    return
  }

  transition = gsap.timeline()
  transition
    .to(light.value, { opacity: 0.35, duration: 0.4, ease: 'power1.out' }, 0)
    .fromTo(
      heading.value,
      { autoAlpha: 0, y: 4 },
      { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' },
      0,
    )
}

/** 取消：和失败一样停掉所有循环，但保留已写好的段数 */
function playCancelled() {
  stopEntrance()
  stopWaiting()
  stopTransition()

  gsap.set(paper.value, { autoAlpha: 1, y: 0, scale: 1 })
  gsap.set(skeleton.value, { autoAlpha: 1, opacity: 0.4 })

  if (reduceMotion) {
    gsap.set(heading.value, { autoAlpha: 1, y: 0 })
    gsap.set(light.value, { opacity: 0.45 })
    return
  }

  transition = gsap.timeline()
  transition
    .to(light.value, { opacity: 0.45, duration: 0.32, ease: 'power1.out' }, 0)
    .fromTo(
      heading.value,
      { autoAlpha: 0, y: 4 },
      { autoAlpha: 1, y: 0, duration: 0.28, ease: 'power2.out' },
      0,
    )
}

function applyStage(stage) {
  if (WORKING_STAGES.includes(stage)) {
    if (entered) {
      // 文案在 waiting / reviewing / fetching 之间切换时，循环不重置
      if (!loops.length && !reduceMotion) resumeWaiting()
      return
    }

    entered = true
    if (skipNext) {
      skipNext = false
      playResumed()
      return
    }
    playEntrance()
    return
  }

  if (stage === 'done') playDone()
  else if (stage === 'cancelled') playCancelled()
  else playFailed()
}

onMounted(() => {
  ctx = gsap.context(() => {
    // 入场前先藏起来；减少动态效果时直接显示静态纸页
    const hidden = reduceMotion || skipNext ? 1 : 0
    gsap.set([paper.value, heading.value, skeleton.value], { autoAlpha: hidden })

    // flush: 'post' 让标题文案先随 stage 更新，再播这一段过渡
    stageWatcher = watch(() => props.stage, applyStage, { immediate: true, flush: 'post' })
  }, paper.value)
})

onBeforeUnmount(() => {
  stageWatcher?.()
  stopEntrance()
  stopWaiting()
  stopTransition()
  ctx?.revert()
})
</script>

<template>
  <section ref="paper" class="paper-stage" :aria-busy="isWorking ? 'true' : undefined">
    <div ref="light" class="botanical-light" aria-hidden="true" />

    <span ref="leaf" class="paper-leaf" aria-hidden="true">
      <Leaf :size="26" :stroke-width="1.1" />
    </span>

    <header ref="heading" class="paper-heading">
      <p class="eyebrow">{{ copy.eyebrow }}</p>
      <h1 class="paper-title">{{ copy.title }}</h1>
      <p class="paper-desc">{{ copy.desc }}</p>
      <p v-if="metaText" class="paper-meta">{{ metaText }}</p>
    </header>

    <div ref="skeleton" class="ink-skeleton" aria-hidden="true">
      <span class="ink-line ink-line--long" />
      <span class="ink-line ink-line--medium" />
      <span class="ink-line ink-line--long" />
      <span class="ink-line ink-line--short" />
    </div>

    <!-- 进度只用段数：不换算百分比，total 为 0 时一个格子都不画 -->
    <div v-if="showProgress" class="paper-progress">
      <div class="segment-track" role="img" :aria-label="progressText">
        <span
          v-for="index in segmentTotal"
          :key="index"
          class="segment-cell"
          :class="{ 'is-filled': index <= segmentDone }"
        />
      </div>
      <p class="segment-text">{{ progressText }}</p>
    </div>

    <div v-if="wordChips.length && stage !== 'done'" class="paper-words">
      <span
        v-for="(word, index) in wordChips"
        :key="word"
        class="word-chip"
        :style="{ '--i': index }"
      >
        {{ word }}
      </span>
    </div>

    <p class="paper-hint" role="status" aria-live="polite">
      {{ cancelling ? '正在停下这次生成，已经写好的部分会保留。' : copy.hint }}
    </p>

    <div v-if="isWorking" class="paper-actions">
      <BaseButton variant="ghost" :disabled="cancelling" @click="emit('cancel')">
        {{ cancelling ? '正在取消…' : '取消生成' }}
      </BaseButton>
    </div>
    <div v-else-if="stage === 'failed' || stage === 'cancelled'" class="paper-actions">
      <BaseButton variant="secondary" @click="emit('back')">返回设置</BaseButton>
    </div>
  </section>
</template>

<style scoped>
.paper-stage {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  width: 100%;
  padding: clamp(24px, 4vw, 44px);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  color: var(--color-ink);
}

/* 一层暖光，等待时缓慢平移；只是装饰，不代表进度 */
.botanical-light {
  position: absolute;
  z-index: -1;
  top: -100px;
  right: -70px;
  width: 240px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgb(143 98 54 / 16%) 0%,
    rgb(143 98 54 / 6%) 44%,
    transparent 72%
  );
  pointer-events: none;
}

.paper-leaf {
  position: absolute;
  top: clamp(20px, 3vw, 34px);
  right: clamp(20px, 3vw, 34px);
  color: var(--color-primary);
  opacity: 0.32;
  pointer-events: none;
}

.eyebrow {
  color: var(--color-muted-2);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  letter-spacing: 0.14em;
}

.paper-title {
  margin-top: var(--space-3);
  font-family: var(--font-display);
  font-size: clamp(21px, 2.5vw, 29px);
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: 0.01em;
}

.paper-desc {
  margin-top: var(--space-2);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.paper-meta {
  margin-top: var(--space-1);
  color: var(--color-muted-2);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  font-variant-numeric: tabular-nums;
}

.ink-skeleton {
  display: grid;
  gap: 15px;
  max-width: 650px;
  margin-top: var(--space-8);
}

.ink-line {
  display: block;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--color-line);
}

.ink-line--long {
  width: 94%;
}

.ink-line--medium {
  width: 77%;
}

.ink-line--short {
  width: 51%;
}

.paper-progress {
  max-width: 650px;
  margin-top: var(--space-5);
}

.segment-track {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 一格 = 一段落的真实进度，不是百分比 */
.segment-cell {
  width: 18px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--color-bg-deep);
  transition: background-color var(--dur-fast) var(--ease-out);
}

.segment-cell.is-filled {
  background: var(--color-primary);
}

.segment-text {
  margin-top: var(--space-2);
  color: var(--color-muted-2);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  font-variant-numeric: tabular-nums;
}

.paper-words {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  max-width: 650px;
  margin-top: var(--space-4);
}

.word-chip {
  padding: 2px 10px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-pill);
  background: var(--color-bg-deep);
  color: var(--color-ink-2);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  animation: word-in 420ms var(--ease-out) both;
  animation-delay: calc(var(--i) * 60ms);
}

@keyframes word-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.paper-hint {
  margin-top: var(--space-6);
  color: var(--color-accent);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.paper-actions {
  margin-top: var(--space-6);
}

@media (prefers-reduced-motion: reduce) {
  .word-chip {
    animation: none;
  }
}

@media (max-width: 767px) {
  .paper-stage {
    padding: var(--space-6) var(--space-5);
  }

  .paper-leaf {
    top: var(--space-5);
    right: var(--space-5);
  }
}
</style>
