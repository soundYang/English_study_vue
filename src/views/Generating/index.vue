<script setup>
/**
 * 生成页
 *
 * 用途：首页 / 设置页点「开始生成」后的等待页。参数经交接单带到这里，
 *       建任务、轮询与纸页动画都在本页发生，成功或失败在同一个视口里交代清楚。
 * 用法：入口页 setGenerationHandoff(...) 后 router.push('/generating')
 *
 * 行为：
 *   - 有交接单：建生成任务，纸页进入等待；正文取到后短暂停留再替换到阅读页
 *   - 刷新 / 重新进入：没有交接单但有 localStorage 的 taskId 时直接续上轮询，
 *     纸页以运行态出现、不重播入场（后端 md/32 §5）
 *   - 失败：纸页停下，错误详情与重试由全局 GenerateOverlay 给出
 *   - 取消：调 /cancel 后继续轮询，等服务端确认 cancelled 再返回来处
 *   - 任务过期回 idle：直接退回来处，不在空白纸页上干等
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PaperStage from './component/PaperStage.vue'
import { useGenerateReading } from '../../composables/useGenerateReading'
import { takeGenerationHandoff } from '../../composables/useGenerationHandoff'
import { useReadingStore } from '../../stores/model/reading'

// 成功文案要在纸页上停一下，让占位线退场、标题换成「准备好了」，再替换到阅读页
const FINISH_DELAY = 560
// 取消后纸页也要把「已暂停」交代完再走
const CANCEL_DELAY = 360

const router = useRouter()
const store = useReadingStore()
const { phase, summary, task, cancelling, cancel, dismiss, resume } = useGenerateReading()

const handoff = takeGenerationHandoff()
let fallbackPath = handoff?.from || '/settings'

const finishing = ref(false)
const skipEntrance = ref(false)
// 进入页面时是否真的接上了一次生成：只有接上了才根据 cancelled / idle 往回跳
const armed = ref(false)
// 成功后 store 会清掉任务快照；纸页还要靠最后一次真实进度把整页写完
const lastProgress = ref({ done: 0, total: 0 })

let exitTimer = null

const stage = computed(() => {
  if (finishing.value) return 'done'
  if (phase.value === 'error') return 'failed'
  if (phase.value === 'cancelled') return 'cancelled'
  if (phase.value === 'fetching') return 'fetching'
  // checking / saving 单独一句「正在校对」，其余等待状态共用一套文案
  if (task.value?.stage === 'checking' || task.value?.stage === 'saving') return 'reviewing'
  return 'waiting'
})

const progress = computed(() => {
  const total = Number(task.value?.progress?.total) || 0
  if (total > 0) return { done: Number(task.value?.progress?.done) || 0, total }
  return lastProgress.value
})

watch(
  () => [Number(task.value?.progress?.done) || 0, Number(task.value?.progress?.total) || 0],
  ([done, total]) => {
    // 只记住出现过真实段数的那一版，0 / 0 不覆盖
    if (total > 0) lastProgress.value = { done, total }
  },
)

const selectedWords = computed(() => task.value?.selectedWords || [])

function goBack() {
  // 先清掉错误，否则覆盖层在目标页上还会再弹一次
  dismiss()
  router.replace(fallbackPath)
}

function handleCancel() {
  cancel()
}

onMounted(() => {
  if (handoff) {
    armed.value = true
    store.generate(handoff.payload, {
      availableWords: handoff.availableWords,
      from: handoff.from,
    })
    return
  }

  // 已经在生成中（例如从别的页面回到本页）：继续等，不再重复发请求
  if (store.isGenerating) {
    armed.value = true
    return
  }

  if (store.reading?.id && store.phase === 'answering') {
    router.replace(`/readings/${store.reading.id}`)
    return
  }

  // 刷新回来：只凭 localStorage 的 taskId 续上，直接以 running 的样子出现
  const resumed = resume()

  if (resumed) {
    armed.value = true
    skipEntrance.value = true
    fallbackPath = resumed.from || fallbackPath
    return
  }

  if (store.reading?.id) {
    router.replace(`/readings/${store.reading.id}`)
    return
  }

  router.replace(fallbackPath)
})

watch(
  () => store.reading?.id,
  (id) => {
    if (!id || finishing.value) return

    finishing.value = true
    exitTimer = setTimeout(() => router.replace(`/readings/${id}`), FINISH_DELAY)
  },
)

watch(phase, (next) => {
  if (!armed.value || finishing.value) return
  if (next !== 'cancelled' && next !== 'idle') return
  if (exitTimer) return

  exitTimer = setTimeout(
    () => router.replace(fallbackPath),
    next === 'cancelled' ? CANCEL_DELAY : 0,
  )
})

onBeforeUnmount(() => {
  if (exitTimer) clearTimeout(exitTimer)
})
</script>

<template>
  <section class="generating-page">
    <PaperStage
      class="generating-paper"
      :stage="stage"
      :summary="summary"
      :progress="progress"
      :selected-words="selectedWords"
      :cancelling="cancelling"
      :skip-entrance="skipEntrance"
      @cancel="handleCancel"
      @back="goBack"
    />
  </section>
</template>

<style scoped>
/* 纸页嵌在内容区中间，导航与顶部栏保持不动；meta.flush 让本页自己掌握留白 */
.generating-page {
  display: grid;
  place-items: center;
  min-height: calc(100dvh - var(--topbar-height));
  /* 纸页按视口高度铺满，这里只留一点呼吸位；底部留太多会多出几像素滚动条 */
  padding: var(--space-10) var(--content-pad-x) var(--space-12);
}

/* 双栏纸页：正文 58 / 题目 42，宽度对齐答题页的双栏上限 */
.generating-paper {
  max-width: 1080px;
}

@media (max-width: 767px) {
  .generating-page {
    min-height: calc(
      100dvh - var(--mobile-topbar-height) - var(--mobile-tabbar-height) -
        env(safe-area-inset-bottom)
    );
    padding: var(--space-6) var(--space-5);
  }
}
</style>
