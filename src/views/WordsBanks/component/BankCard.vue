<script setup>
/**
 * 词库概要卡
 *
 * 用途：词库总览页的一张卡片，展示词库总量、已导入量、个人词库剩余名额与操作。
 * 用法：<BankCard :bank="bank" @manage="go" @reset="askReset" />
 *
 * props:
 *   bank — { key, label, rankMin, rankMax, total, imported, importedInLibrary, remainingSlots }
 * emits:
 *   manage — 进入词库详情（已导入时按钮文案为「管理」，否则「去挑选」）
 *   reset  — 请求重置该词库
 */
import { computed } from 'vue'
import { ArrowRight, Layers, RotateCcw } from 'lucide-vue-next'
import BaseButton from '../../../component/BaseButton.vue'

const props = defineProps({
  bank: { type: Object, required: true },
})

const emit = defineEmits(['manage', 'reset'])

const hasImported = computed(() => (props.bank.imported || 0) > 0)
const rangeLabel = computed(() => `COCA ${props.bank.rankMin ?? '—'}–${props.bank.rankMax ?? '—'}`)
</script>

<template>
  <article class="bank-card" :class="{ 'is-active': hasImported }">
    <header class="card-head">
      <span class="card-icon" aria-hidden="true">
        <Layers :size="18" :stroke-width="1.7" />
      </span>
      <div class="card-title-block">
        <h3 class="card-title">{{ bank.label }}</h3>
        <p class="card-range">{{ rangeLabel }}</p>
      </div>
    </header>

    <dl class="card-stats">
      <div class="stat">
        <dt>目录总量</dt>
        <dd>{{ bank.total }}</dd>
      </div>
      <div class="stat">
        <dt>已导入</dt>
        <dd class="stat-strong">{{ bank.imported }}</dd>
      </div>
      <div class="stat">
        <dt>剩余名额</dt>
        <dd>{{ bank.remainingSlots }}</dd>
      </div>
    </dl>

    <p v-if="bank.importedInLibrary !== bank.imported" class="card-note">
      有 {{ bank.imported - bank.importedInLibrary }} 个导入词已被手动删除。
    </p>

    <footer class="card-actions">
      <BaseButton variant="primary" size="sm" @click="emit('manage')">
        {{ hasImported ? '管理' : '去挑选' }}
        <ArrowRight :size="14" :stroke-width="1.8" aria-hidden="true" />
      </BaseButton>
      <BaseButton
        v-if="hasImported"
        class="reset-bank"
        variant="ghost"
        size="sm"
        @click="emit('reset')"
      >
        <RotateCcw :size="14" :stroke-width="1.8" aria-hidden="true" />
        重置
      </BaseButton>
    </footer>
  </article>
</template>

<style scoped>
.bank-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  transition:
    border-color var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out);
}

.bank-card:hover {
  border-color: var(--color-line-strong);
  box-shadow: var(--shadow-md);
}

.bank-card.is-active {
  border-color: color-mix(in srgb, var(--color-primary-ink) 28%, var(--color-line));
}

.card-head {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.card-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--color-bg-deep);
  color: var(--color-primary-ink);
}

.card-title-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.card-title {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: var(--text-section);
  font-weight: 500;
  line-height: var(--leading-section);
}

.card-range {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  font-variant-numeric: tabular-nums;
}

.card-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-line);
  border-bottom: 1px solid var(--color-line);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat dt {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.stat dd {
  margin: 0;
  color: var(--color-ink);
  font-size: var(--text-body);
  line-height: var(--leading-body);
  font-variant-numeric: tabular-nums;
}

.stat dd.stat-strong {
  color: var(--color-primary-ink);
  font-weight: 600;
}

.card-note {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.card-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: auto;
}

.card-actions :deep(button) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 767px) {
  .bank-card {
    padding: var(--space-4) var(--space-5);
  }
}
</style>
