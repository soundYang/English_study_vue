<script setup>
/**
 * 首页视图
 * 呈现 Hero 与三个入口；负责“开始阅读”的未设置 / 空词库 / 直接生成三条分支。
 * 词汇总数只用于提示，请求失败时静默隐藏，不阻塞页面。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, NotebookPen, Sparkles } from 'lucide-vue-next'
import BaseButton from '../../component/BaseButton.vue'
import BaseModal from '../../component/BaseModal.vue'
import EntryCard from './component/EntryCard.vue'
import HeroPanel from './component/HeroPanel.vue'
import { fetchWords } from '../../api/words'
import { useGenerateReading } from '../../composables/useGenerateReading'
import { useToast } from '../../composables/useToast'
import { useSettingsStore } from '../../stores/model/settings'

const router = useRouter()
const toast = useToast()
const settings = useSettingsStore()
const { start } = useGenerateReading()

const totalWords = ref(null)
const availableWords = ref(null)
const emptyDialogOpen = ref(false)

const wordMeta = computed(() =>
  totalWords.value === null ? '' : `已收录 ${totalWords.value} 个单词`,
)

onMounted(async () => {
  try {
    const result = await fetchWords({ page: 1, pageSize: 1 })
    totalWords.value = result.total
    availableWords.value = result.counts.learning + result.counts.mastered
  } catch {
    totalWords.value = null
    availableWords.value = null
  }
})

async function beginGeneration() {
  const generated = await start(settings.payload, { availableWords: availableWords.value })
  if (generated) router.push(`/readings/${generated.id}`)
}

function handleStartReading() {
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

    <div class="entries">
      <EntryCard
        title="我的单词"
        desc="管理你的词汇库。添加、编辑或删除单词。"
        :icon="BookOpen"
        :meta="wordMeta"
        to="/words"
        :delay="0"
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
        :delay="160"
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
.entries {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
  margin-top: var(--space-10);
}

@media (max-width: 1023px) {
  .entries {
    gap: var(--space-4);
  }
}

@media (max-width: 767px) {
  .entries {
    grid-template-columns: 1fr;
    margin-top: var(--space-8);
  }
}
</style>
