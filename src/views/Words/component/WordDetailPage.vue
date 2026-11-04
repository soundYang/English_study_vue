<script setup>
/**
 * 单词详情纸页
 *
 * 用途：从词书翻进去的一张独立纸页，展示单词、音标、全部义项与元信息；
 *       数据全部来自列表快照，不额外请求（md/55 §3.2 G）。
 * 用法：<WordDetailPage :item="item" @back="..." @edit="..." @remove="..." />
 *
 * props:
 *   item — WordDto
 * emits:
 *   back / edit / remove — 返回列表 / 编辑 / 删除，后两者参数为 item
 * 说明：后端暂无语例句字段，因此不渲染「例句」Tab；需要时先补后端（md/55 §12）。
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { ArrowLeft, Pencil, Trash2, Volume2 } from 'lucide-vue-next'
import StatusPill from '../../../component/StatusPill.vue'
import { formatDate } from '../../../unit/format'
import { phoneticParts } from '../../../unit/phonetic'
import { canSpeak, speakWord } from '../../../unit/pronounce'
import { frequencyTierOf } from '../../../unit/word-tiers'

const BANK_LABELS = { high: '高频', mid: '中频' }
const SOURCE_LABELS = { dictionary: '词库', manual: '手填', 'basic-removed': '基础词' }

const props = defineProps({
  item: { type: Object, required: true },
})

const emit = defineEmits(['back', 'edit', 'remove'])

const heading = ref(null)
const speakable = canSpeak()

const phonetics = computed(() => phoneticParts(props.item.phonetic))
const senses = computed(() => (props.item.senses || []).filter((sense) => sense?.meaning))

const sourceLabel = computed(() => {
  const banks = Array.isArray(props.item.wordBanks) ? props.item.wordBanks : []
  if (banks.length) {
    return banks.map((bank) => `词库·${BANK_LABELS[bank] || bank}`).join(' / ')
  }
  return SOURCE_LABELS[props.item.source] || '—'
})

const reviewLabel = computed(() => {
  const stage = Number(props.item.reviewStage) || 0
  const lapse = Number(props.item.lapseCount) || 0
  let text = stage > 0 ? `已通过 ${stage} 轮` : '尚未复习'
  if (lapse > 0) text += `，忘记 ${lapse} 次`
  return text
})

const frequencyLabel = computed(() => {
  const tier = frequencyTierOf(props.item.cocaRank)
  if (!tier) return '—'
  return `COCA #${props.item.cocaRank} · ${tier.label}`
})

const facts = computed(() => [
  { label: '复习轮次', value: reviewLabel.value },
  { label: '词库来源', value: sourceLabel.value },
  { label: 'COCA 词频', value: frequencyLabel.value },
  { label: '收录日期', value: formatDate(props.item.createdAt) || '—' },
])

onMounted(async () => {
  await nextTick()
  heading.value?.focus()
})

function speak() {
  speakWord(props.item.word)
}
</script>

<template>
  <article class="word-detail-page" aria-label="单词详情">
    <header class="detail-top">
      <button type="button" class="back-link" @click="emit('back')">
        <ArrowLeft :size="16" :stroke-width="1.8" aria-hidden="true" />
        返回我的单词
      </button>

      <div class="detail-actions">
        <button type="button" class="top-action" @click="emit('edit', item)">
          <Pencil :size="15" :stroke-width="1.8" aria-hidden="true" />
          编辑
        </button>
        <button type="button" class="top-action is-danger" @click="emit('remove', item)">
          <Trash2 :size="15" :stroke-width="1.8" aria-hidden="true" />
          删除
        </button>
      </div>
    </header>

    <div class="detail-hero">
      <h2 ref="heading" class="detail-word" tabindex="-1">{{ item.word }}</h2>
      <button
        v-if="speakable"
        type="button"
        class="detail-speak"
        :aria-label="`朗读 ${item.word}`"
        @click="speak"
      >
        <Volume2 :size="18" :stroke-width="1.8" aria-hidden="true" />
      </button>
      <StatusPill kind="status" :value="item.studyState" :stage="item.reviewStage || 0" />
    </div>

    <p class="detail-phonetic" :class="{ 'is-empty': !phonetics.length }" lang="en">
      <template v-if="phonetics.length">
        <span v-for="part in phonetics" :key="part.label" class="phonetic-part">
          {{ part.label }} {{ part.value }}
        </span>
      </template>
      <template v-else>暂无音标</template>
    </p>

    <section class="detail-section">
      <h3 class="section-title">词义</h3>
      <ol v-if="senses.length" class="sense-list">
        <li v-for="(sense, index) in senses" :key="index" class="sense-item">
          <span class="sense-index">{{ index + 1 }}.</span>
          <span v-if="sense.pos" class="sense-pos">{{ sense.pos }}</span>
          <span class="sense-meaning">{{ sense.meaning }}</span>
        </li>
      </ol>
      <p v-else class="sense-empty">这条词还没有释义。</p>
    </section>

    <dl class="fact-row">
      <div class="fact">
        <dt class="fact-label">学习状态</dt>
        <dd class="fact-value">
          <StatusPill kind="status" :value="item.studyState" :stage="item.reviewStage || 0" />
        </dd>
      </div>
      <div v-for="fact in facts" :key="fact.label" class="fact">
        <dt class="fact-label">{{ fact.label }}</dt>
        <dd class="fact-value">{{ fact.value }}</dd>
      </div>
    </dl>
  </article>
</template>

<style scoped>
.word-detail-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6) var(--space-8);
  border: 1px solid var(--color-line-strong);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.detail-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.back-link,
.top-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.back-link:hover,
.top-action:hover {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.detail-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.top-action.is-danger:hover {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.detail-hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.detail-word {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-reading);
  font-size: clamp(30px, 4vw, 40px);
  font-weight: 500;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.detail-word:focus {
  outline: none;
}

.detail-speak {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--color-bg-deep);
  color: var(--color-ink-2);
}

.detail-speak:hover {
  background: var(--color-line);
}

.detail-phonetic {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: calc(var(--space-3) * -1);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.detail-phonetic.is-empty {
  color: var(--color-muted);
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-line);
}

.section-title {
  margin: 0;
  color: var(--color-muted);
  font-size: var(--text-caption);
  font-weight: 500;
  line-height: var(--leading-caption);
  letter-spacing: 0.08em;
}

.sense-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.sense-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--color-ink-2);
  font-size: 16px;
  line-height: 27px;
}

.sense-index {
  flex: 0 0 auto;
  color: var(--color-muted);
  font-family: var(--font-reading);
  font-size: var(--text-small);
}

.sense-pos {
  flex: 0 0 auto;
  color: var(--color-accent);
  font-size: var(--text-caption);
}

.sense-meaning {
  overflow-wrap: anywhere;
}

.sense-empty {
  color: var(--color-muted);
  font-size: var(--text-small);
}

.fact-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4) var(--space-8);
  margin: 0;
  padding-top: var(--space-4);
  border-top: 1px dashed var(--color-line);
}

.fact {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fact-label {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.fact-value {
  margin: 0;
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

@media (max-width: 767px) {
  .word-detail-page {
    padding: var(--space-5);
  }

  .detail-top {
    flex-wrap: wrap;
  }

  .fact-row {
    gap: var(--space-4);
  }
}
</style>
