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

// 写文章阶段远长于其他阶段，主提示按 md/22 §8.5 保持固定，这里只轮换一句辅助文案，
// 让长时间等待有可见的变化，又不会让人误以为阶段在推进
const WAITING_TIPS = [
  '学过的词，正在变成句子。',
  '每写完一段，就接着往下走。',
  '故事会沿着刚才的地方继续。',
  '用你认识的词，慢慢把这一篇写完。',
]
const TIP_INTERVAL_MS = 5000
// 后端并发写 4 段，done 会一次跳几格；显示上逐格补亮，
// 但永远不超过后端已确认的 done，不伪造没写完的段
const FILL_STEP_MAX_MS = 160
const FILL_STEP_MIN_MS = 60
const FILL_RAMP_MS = 800

// 骨架按「一整页文章」来画：段数用后端真实值，每段的行数按目标篇长估。
// 一篇 600 词的阅读约 22 行，100 词约 10 行；夹住上下限，
// 短篇也有整页的感觉，长篇也不会把纸页撑出视口。
const MIN_PAGE_LINES = 10
const MAX_PAGE_LINES = 22
const FALLBACK_PARAGRAPHS = 3
const LINE_WIDTHS = {
  2: [100, 56],
  3: [100, 96, 54],
  4: [100, 97, 94, 58],
  5: [100, 98, 95, 99, 52],
}
// 抽到的词一次全展示，词多时截在 30 个，避免纸页下面铺得太长
const MAX_WORD_CHIPS = 30

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
const tipIndex = ref(0)

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
// 只影响画面：缓缓追上 segmentDone，永远不会超过它
const shownDone = ref(segmentDone.value)
const progressText = computed(() =>
  segmentTotal.value > 0 ? `已写 ${shownDone.value} / ${segmentTotal.value} 段` : '',
)
const showProgress = computed(() => segmentTotal.value > 0 && props.stage !== 'done')
// 取消中的提示优先于阶段文案；用 key 切换，让每次换字都轻轻淡入
const hintText = computed(() =>
  props.cancelling ? '正在停下这次生成，已经写好的部分会保留。' : copy.value.hint,
)
const tipText = computed(() => WAITING_TIPS[tipIndex.value] || '')
const wordChips = computed(() =>
  props.selectedWords
    .map((item) => (typeof item === 'string' ? item : item?.word))
    .filter(Boolean)
    .slice(0, MAX_WORD_CHIPS),
)

// 一段 = 后端的一段；行数由目标篇长决定，写完的段落（is-written）由 shownDone 点亮
const paragraphs = computed(() => {
  const total = segmentTotal.value || FALLBACK_PARAGRAPHS
  const targetWords = Number(props.summary?.targetWords) || 0
  const roughLines = targetWords > 0 ? Math.round(targetWords / 12) : 15
  const budget = Math.max(MIN_PAGE_LINES, Math.min(MAX_PAGE_LINES, roughLines))
  const lineCount = Math.max(2, Math.min(5, Math.round(budget / total)))
  const widths = LINE_WIDTHS[lineCount] || LINE_WIDTHS[3]

  return Array.from({ length: total }, (_, index) => ({
    index: index + 1,
    lines: widths.map((width, line) => ({
      index: line + 1,
      // 每段最后一行短一截，段与段之间才像真的换行
      width: line === widths.length - 1 ? width - (index % 3) * 4 : width,
    })),
  }))
})

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
let tipTimer = null
let fillTimer = null

// 主提示不变，辅助文案每 5s 换一句；只做文字更新，不涉及 GSAP
function stopTip() {
  if (tipTimer) clearInterval(tipTimer)
  tipTimer = null
}

function startTip() {
  stopTip()
  tipIndex.value = 0
  if (WAITING_TIPS.length < 2) return

  tipTimer = setInterval(() => {
    tipIndex.value = (tipIndex.value + 1) % WAITING_TIPS.length
  }, TIP_INTERVAL_MS)
}

function stopFill() {
  if (fillTimer) clearTimeout(fillTimer)
  fillTimer = null
}

/**
 * 让已填格逐步追上真实 done
 * 后端并发 4 段，一次轮询可能同时完成 4 段；直接把 4 格点亮会像「瞬间 100%」。
 * 这里按格补亮（一批最多 800ms），显示值只增不减且不超过 segmentDone。
 */
function syncFill() {
  const target = segmentDone.value

  if (target <= shownDone.value) {
    stopFill()
    shownDone.value = Math.max(0, target)
    return
  }

  // 已经在追了：让现有 tick 自己读取新目标，避免叠加两条定时链
  if (fillTimer) return

  const delayOf = (gap) =>
    Math.max(FILL_STEP_MIN_MS, Math.min(FILL_STEP_MAX_MS, FILL_RAMP_MS / Math.max(1, gap)))

  const tick = () => {
    fillTimer = null
    if (segmentDone.value <= shownDone.value) return

    shownDone.value += 1
    if (shownDone.value < segmentDone.value) {
      fillTimer = setTimeout(tick, delayOf(segmentDone.value - shownDone.value))
    }
  }

  fillTimer = setTimeout(tick, delayOf(target - shownDone.value))
}

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

/** 成功：整页写满的样子留在纸上，标题换成「准备好了」，随后由生成页替换到阅读页 */
function playDone() {
  // 必须连 entrance 一起停：提前成功时它末尾的 .add(playWaiting) 会把循环重新拉起来
  stopEntrance()
  stopWaiting()
  stopTransition()

  gsap.set(paper.value, { autoAlpha: 1, y: 0, scale: 1 })
  gsap.set(light.value, { opacity: 0.55 })
  // 成功时整页已经写满，保留纸页让「落页」看得见，不要瞬间抽空
  gsap.set(skeleton.value, { autoAlpha: 1, opacity: 0.9 })

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

// 等待阶段的辅助文案轮换；进度补亮只读 props，不需要等 GSAP
watch(
  () => props.stage,
  (stage) => {
    if (stage === 'waiting') startTip()
    else stopTip()

    // 终态不再补亮：失败 / 取消要立刻显示真实已完成的段数
    if (stage === 'done' || stage === 'failed' || stage === 'cancelled') {
      stopFill()
      shownDone.value = segmentDone.value
    }
  },
  { immediate: true },
)

watch([segmentDone, segmentTotal], syncFill)

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
  stopTip()
  stopFill()
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
      <h1 :key="copy.title" class="paper-title copy-in">{{ copy.title }}</h1>
      <p :key="copy.desc" class="paper-desc copy-in">{{ copy.desc }}</p>
      <p v-if="metaText" class="paper-meta">{{ metaText }}</p>
    </header>

    <!-- 整页正文骨架：一段 = 后端一段，写完一段就有一段落墨 -->
    <div class="paper-sheet">
      <div ref="skeleton" class="ink-skeleton" aria-hidden="true">
        <div
          v-for="paragraph in paragraphs"
          :key="paragraph.index"
          class="ink-paragraph"
          :class="{ 'is-written': paragraph.index <= shownDone }"
        >
          <span
            v-for="line in paragraph.lines"
            :key="line.index"
            class="ink-line"
            :style="{ width: `${line.width}%` }"
          />
        </div>
      </div>

      <!-- 进度只用段数：不换算百分比，total 为 0 时一个格子都不画 -->
      <footer v-if="showProgress" class="paper-foot paper-progress">
        <span class="paper-brand">ENGLISH READER</span>
        <span class="paper-progress-meta">
          <span class="segment-track" role="img" :aria-label="progressText">
            <span
              v-for="index in segmentTotal"
              :key="index"
              class="segment-cell"
              :class="{ 'is-filled': index <= shownDone }"
              :style="{ '--i': index }"
            />
          </span>
          <span class="segment-text">{{ progressText }}</span>
        </span>
      </footer>
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

    <p :key="hintText" class="paper-hint copy-in" role="status" aria-live="polite">
      {{ hintText }}
    </p>
    <p
      v-if="stage === 'waiting' && tipText"
      :key="tipIndex"
      class="paper-tip tip-in"
      aria-hidden="true"
    >
      {{ tipText }}
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

/* 标题下面是一整页纸：骨架铺满整页，等待时像一篇文章正在写出来 */
.paper-sheet {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-5);
  min-height: clamp(280px, 36vh, 440px);
  margin-top: var(--space-6);
  padding: clamp(18px, 3vw, 28px);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, var(--color-surface-2), var(--color-surface));
}

.ink-skeleton {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-4);
  width: 100%;
}

.ink-paragraph {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.ink-line {
  display: block;
  height: 7px;
  border-radius: var(--radius-pill);
  background: var(--color-line);
  transition:
    background-color 480ms var(--ease-out),
    opacity 480ms var(--ease-out);
}

/* 写完的那一段：占位线落成更深的墨色，像真的写在了纸上 */
.ink-paragraph.is-written .ink-line {
  background: var(--color-ink-2);
  opacity: 0.4;
}

.paper-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-line);
}

.paper-brand {
  color: var(--color-muted-2);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  letter-spacing: 0.16em;
}

.paper-progress-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.segment-track {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

/* 一格 = 一段落的真实进度，不是百分比 */
.segment-cell {
  width: 16px;
  height: 5px;
  border-radius: var(--radius-pill);
  background: var(--color-bg-deep);
  transition: background-color var(--dur-fast) var(--ease-out);
}

.segment-cell.is-filled {
  background: var(--color-primary);
}

.segment-text {
  color: var(--color-muted-2);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.paper-words {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
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

/* 文案换句时轻轻淡入；只有 key 变化才重播，纸页本身不跟着抖 */
.copy-in {
  animation: copy-in 340ms var(--ease-out) both;
}

.paper-tip {
  margin-top: var(--space-2);
  color: var(--color-muted-2);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.tip-in {
  animation: copy-in 320ms var(--ease-out) both;
}

@keyframes copy-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.paper-actions {
  margin-top: var(--space-6);
}

@media (prefers-reduced-motion: reduce) {
  .word-chip,
  .copy-in,
  .tip-in {
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
