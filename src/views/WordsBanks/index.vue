<script setup>
/**
 * 词库总览页
 *
 * 用途：展示高频 / 中频两个可选词库的规模、已导入量与个人词库剩余名额，
 *       并保留「基础词汇库」入口（原先在侧栏，md/55 §2.2）。
 * 用法：路由 /words/banks
 *
 * 行为：
 *   - 已导入过 → 「管理 / 重置」；未导入 → 「去挑选」
 *   - 重置二次确认写明「只移除从该词库导入的词」，成功后刷新概要与「我的单词」
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, Library, RefreshCw } from 'lucide-vue-next'
import BaseButton from '../../component/BaseButton.vue'
import ConfirmDialog from '../../component/ConfirmDialog.vue'
import EmptyState from '../../component/EmptyState.vue'
import BankCard from './component/BankCard.vue'
import WordsSubnav from '../Words/component/WordsSubnav.vue'
import { useToast } from '../../composables/useToast'
import { useWordBanksStore } from '../../stores/model/word-banks'

const router = useRouter()
const toast = useToast()
const store = useWordBanksStore()

const resetTarget = ref(null)
const resetting = ref(false)

const loading = computed(() => store.banksLoading && !store.banks.length)
const remainingSlots = computed(() => store.banks[0]?.remainingSlots ?? null)

onMounted(() => {
  store.fetchBanks()
})

function openBank(key) {
  router.push({ name: 'words-bank-detail', params: { bank: key } })
}

function askReset(bank) {
  resetTarget.value = bank
}

async function confirmReset() {
  const target = resetTarget.value
  if (!target) return

  resetting.value = true
  const result = await store.resetBank(target.key)
  resetting.value = false

  if (result.ok) {
    resetTarget.value = null
    toast.success(
      `已重置${target.label}：移除 ${result.removedWords} 个词，保留 ${result.keptWords} 个`,
    )
  } else {
    toast.error(result.message || '重置失败，请稍后再试')
  }
}
</script>

<template>
  <div class="banks-page">
    <header class="page-head">
      <div class="head-copy">
        <p class="eyebrow">我的单词</p>
        <h1 class="page-title">
          <Library :size="22" :stroke-width="1.6" aria-hidden="true" />
          词库
        </h1>
        <p class="page-desc">
          从高频、中频词库中挑选单词加入个人词库。导入的词会参与阅读生成与复习计划。
        </p>
      </div>
      <WordsSubnav />
    </header>

    <div v-if="loading" class="bank-grid">
      <div v-for="index in 2" :key="index" class="bank-skeleton" aria-hidden="true">
        <span class="skeleton-line is-title"></span>
        <span class="skeleton-line"></span>
        <span class="skeleton-line is-short"></span>
      </div>
    </div>

    <EmptyState
      v-else-if="store.banksError"
      class="banks-error"
      title="词库加载失败"
      :description="store.banksError"
    >
      <template #actions>
        <BaseButton variant="secondary" @click="store.fetchBanks()">
          <RefreshCw :size="15" :stroke-width="1.8" aria-hidden="true" />
          重试
        </BaseButton>
      </template>
    </EmptyState>

    <template v-else>
      <div v-if="remainingSlots !== null" class="slot-strip">
        个人词库还剩
        <strong>{{ remainingSlots }}</strong>
        个名额，两个词库共用。
      </div>

      <div class="bank-grid">
        <BankCard
          v-for="bank in store.banks"
          :key="bank.key"
          :bank="bank"
          @manage="openBank(bank.key)"
          @reset="askReset(bank)"
        />
      </div>

      <RouterLink to="/basic-words" class="basic-entry">
        <span class="basic-icon" aria-hidden="true">
          <BookOpen :size="18" :stroke-width="1.7" />
        </span>
        <span class="basic-copy">
          <span class="basic-title">基础词汇库</span>
          <span class="basic-desc">650 个最常用词，可逐个标记认识 / 不认识。</span>
        </span>
        <span class="basic-arrow" aria-hidden="true">→</span>
      </RouterLink>
    </template>

    <ConfirmDialog
      :open="Boolean(resetTarget)"
      :title="`重置${resetTarget?.label || '词库'}？`"
      description="只移除从该词库导入的词，你自己原有的词不受影响。此操作不可撤销。"
      confirm-text="重置词库"
      danger
      :loading="resetting"
      @update:open="(open) => !open && (resetTarget = null)"
      @confirm="confirmReset"
    />
  </div>
</template>

<style scoped>
.banks-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-5) var(--space-8);
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.head-copy {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.eyebrow {
  margin: 0;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.page-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: var(--text-page-title);
  font-weight: 500;
  line-height: var(--leading-page-title);
}

.page-desc {
  max-width: 56ch;
  margin: 0;
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.slot-strip {
  padding: var(--space-3) var(--space-4);
  border: 1px dashed var(--color-line-strong);
  border-radius: var(--radius-md);
  background: var(--color-bg-deep);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.slot-strip strong {
  color: var(--color-primary-ink);
  font-variant-numeric: tabular-nums;
}

.bank-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-4);
}

.bank-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 220px;
  padding: var(--space-5) var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.skeleton-line {
  display: block;
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--color-bg-deep) 0%,
    var(--color-line) 50%,
    var(--color-bg-deep) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-sweep 1.4s ease-in-out infinite;
}

.skeleton-line.is-title {
  width: 42%;
  height: 18px;
}

.skeleton-line.is-short {
  width: 64%;
}

@keyframes skeleton-sweep {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

.banks-error {
  padding: var(--space-8) 0;
}

.basic-entry {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-ink);
  text-decoration: none;
  transition:
    border-color var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out);
}

.basic-entry:hover {
  border-color: var(--color-line-strong);
  box-shadow: var(--shadow-sm);
}

.basic-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--color-bg-deep);
  color: var(--color-primary-ink);
}

.basic-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.basic-title {
  font-size: var(--text-body);
  font-weight: 500;
  line-height: var(--leading-body);
}

.basic-desc {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.basic-arrow {
  margin-left: auto;
  color: var(--color-muted);
}

@media (max-width: 767px) {
  .banks-page {
    padding: var(--space-5) var(--space-4) var(--space-6);
  }
}
</style>
