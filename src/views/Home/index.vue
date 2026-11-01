<script setup>
/**
 * 首页视图
 * 呈现 Hero 与三个入口；负责“开始阅读”的未设置 / 空词库 / 交给生成页三条分支。
 * 游客可浏览首页，但不请求词库 / 预检 / 额度 / 自备 Key；点「开始阅读」去登录（md/42）。
 * 词汇总数只用于提示，请求失败时静默隐藏，不阻塞页面。
 * 每日额度由 useQuota 取一次：有剩余时显示「今日剩余 N 次」，用尽时直接禁用入口。
 */
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { BookOpen, NotebookPen, Sparkles } from 'lucide-vue-next'
import BaseButton from '../../component/BaseButton.vue'
import BaseModal from '../../component/BaseModal.vue'
import EntryCard from './component/EntryCard.vue'
import HeroPanel from './component/HeroPanel.vue'
import { fetchCapacity } from '../../api/readings'
import { fetchStudyStats, fetchWords } from '../../api/words'
import { useAuthGate } from '../../composables/useAuthGate'
import { hasGenerationHandoff, setGenerationHandoff } from '../../composables/useGenerationHandoff'
import { useQuota } from '../../composables/useQuota'
import { useToast } from '../../composables/useToast'
import { useAuthStore } from '../../stores/model/auth'
import { useSettingsStore } from '../../stores/model/settings'

const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const { requireAuth } = useAuthGate()
const settings = useSettingsStore()
// 游客不请求额度与自备 Key；入口仍可点击，由 requireAuth 带去登录（md/42）
const {
  quotaNote,
  canGenerate,
  isBlocked: quotaBlocked,
} = useQuota({ enabled: () => auth.isAuthenticated })

const totalWords = ref(null)
const availableWords = ref(null)
// 待复习词数：> 0 时「我的单词」入口显示红点（md/56 P3）。失败就当作 0，不打扰用户
const pendingReview = ref(0)
const emptyDialogOpen = ref(false)

const wordMeta = computed(() => {
  if (!auth.isAuthenticated) return '登录后查看你的词库'
  return totalWords.value === null ? '' : `已收录 ${totalWords.value} 个单词`
})

const startReadingMeta = computed(() => {
  if (!auth.isAuthenticated) return '登录后即可生成专属阅读'
  // 用尽时卡内只留一句结论，完整说明与接入入口放在卡组上方的提示条里
  return quotaBlocked.value ? '今天的免费次数用完了' : quotaNote.value
})

async function loadUserSummary() {
  if (!auth.isAuthenticated) {
    totalWords.value = null
    availableWords.value = null
    pendingReview.value = 0
    return
  }

  try {
    const result = await fetchWords({ page: 1, pageSize: 1 })
    totalWords.value = result.total
    availableWords.value = result.counts.learning + result.counts.mastered
  } catch {
    totalWords.value = null
    availableWords.value = null
  }

  // 复习红点只是提示：统计失败时保持 0，不影响首页其余内容
  try {
    const stats = await fetchStudyStats()
    pendingReview.value = Math.max(0, Number(stats?.pendingReview) || 0)
  } catch {
    pendingReview.value = 0
  }

  // 预检失败不影响首页：拿不到就沿用词库口径的数字，生成时以后端为准
  try {
    // 词源要跟生成时一致，否则首页的「基于你的 N 个单词」是全量口径
    const capacity = await fetchCapacity({
      targetWords: settings.targetWords,
      vocabScope: [...settings.vocabScope],
    })
    if (capacity?.available != null) availableWords.value = capacity.available
  } catch {
    // 静默失败：首页只需要一个提示数字，弹错反而挡住「开始阅读」
  }
}

onMounted(loadUserSummary)

function beginGeneration() {
  // 参数与词库口径交给生成页；动画和请求都在那一页完成，这里只负责跳转。
  // 交接单还没被取走时不要覆盖：连点两下仍然只发一次生成
  if (!hasGenerationHandoff()) {
    setGenerationHandoff(settings.payload, { availableWords: availableWords.value, from: '/' })
  }
  router.push('/generating')
}

function startReadingFlow() {
  if (!settings.hasSavedSettings) {
    toast.info('先完成阅读设置，再开始生成')
    router.push('/settings')
    return
  }

  // 词汇总数未知（请求失败）时不阻塞生成，交给后端返回明确错误
  if (totalWords.value === 0) {
    emptyDialogOpen.value = true
    return
  }

  beginGeneration()
}

function handleStartReading() {
  // 游客先去登录；登录后回到设置页，避免直接进生成页时缺交接单
  requireAuth(startReadingFlow, { redirect: '/settings' })
}

function goAddWords() {
  emptyDialogOpen.value = false
  router.push('/words')
}

function tryAnyway() {
  emptyDialogOpen.value = false
  beginGeneration()
}
</script>

<template>
  <section class="home">
    <HeroPanel />

    <!-- 免费次数用尽：入口被禁用，这里给出唯一可行的一条路 -->
    <p v-if="quotaBlocked" class="home-quota" role="status">
      {{ quotaNote }}
      <RouterLink class="home-quota-link" :to="{ path: '/profile', hash: '#api-settings' }">
        去接入 API Key
      </RouterLink>
    </p>

    <div class="entries">
      <EntryCard
        title="我的单词"
        desc="管理你的词汇库。添加、编辑或删除单词。"
        :icon="BookOpen"
        :meta="wordMeta"
        to="/words"
        :delay="0"
        :dot="pendingReview > 0"
        :dot-label="`有 ${pendingReview} 个单词待复习`"
      />
      <EntryCard
        title="阅读设置"
        desc="选择难度、文章长度和题目数量。"
        :icon="NotebookPen"
        to="/settings"
        :delay="80"
      />
      <EntryCard
        title="开始阅读"
        desc="AI 为你生成专属阅读材料，开启你的学习之旅。"
        :icon="Sparkles"
        :meta="startReadingMeta"
        :delay="160"
        :disabled="!canGenerate"
        @select="handleStartReading"
      />
    </div>

    <BaseModal
      v-model:open="emptyDialogOpen"
      title="词汇库还是空的"
      description="生成可能失败。要先去添加单词吗？"
      :max-width="440"
      :close-on-backdrop="false"
      :show-close="false"
    >
      <template #footer>
        <BaseButton variant="secondary" @click="tryAnyway">仍然尝试</BaseButton>
        <BaseButton @click="goAddWords">去添加单词</BaseButton>
      </template>
    </BaseModal>
  </section>
</template>

<style scoped>
/* 首页走 meta.flush，内容区没有内边距，这里自己补回左右留白 */
.home-quota {
  width: 100%;
  max-width: var(--content-max-wide);
  margin: var(--space-5) auto 0;
  padding: 0 var(--content-pad-x);
  color: var(--color-warning);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.home-quota-link {
  margin-left: var(--space-1);
  color: var(--color-accent);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.home-quota-link:hover {
  color: var(--color-ink);
}

.entries {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
  width: 100%;
  max-width: var(--content-max-wide);
  /* 横幅下缘是整幅实景图，卡片组留一段呼吸空间再起；超宽屏时整组居中 */
  margin: var(--space-8) auto 0;
  padding: 0 var(--content-pad-x) var(--space-16);
}

@media (max-width: 1023px) {
  .entries {
    gap: var(--space-4);
  }
}

@media (max-width: 767px) {
  .entries {
    grid-template-columns: 1fr;
    padding-bottom: var(--space-10);
  }
}
</style>
