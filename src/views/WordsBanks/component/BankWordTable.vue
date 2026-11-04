<script setup>
/**
 * 词库目录列表
 *
 * 用途：展示词库目录的单词、音标、释义、词频与个人状态；桌面为表格式行，
 *       移动端收成卡片。选择由父级维护，本组件只上报被切换的词。
 * 用法：<BankWordTable :items="items" :tab="tab" :selected="selectedWords" @toggle="toggleWord" />
 *
 * props:
 *   items    — 目录项（word / rank / phonetic / senses / summary / inLibrary /
 *              personalStudyState / imported）
 *   tab      — not_imported（显示「已在词库（原有）」）或 imported（显示学习状态）
 *   selected — 已选词形数组
 * emits:
 *   toggle — 点击复选框，参数为完整目录项
 */
import { computed } from 'vue'
import StatusPill from '../../../component/StatusPill.vue'
import { phoneticParts } from '../../../unit/phonetic'

const props = defineProps({
  items: { type: Array, default: () => [] },
  tab: { type: String, default: 'not_imported' },
  selected: { type: Array, default: () => [] },
})

const emit = defineEmits(['toggle'])

const selectedSet = computed(() => new Set(props.selected))

function partsOf(item) {
  return phoneticParts(item.phonetic)
}
</script>

<template>
  <div class="bank-word-table">
    <div class="list-head" aria-hidden="true">
      <span class="head-check"></span>
      <span>单词</span>
      <span>释义</span>
      <span class="head-rank">词频</span>
      <span class="head-state">状态</span>
    </div>

    <ul class="bank-word-list">
      <li
        v-for="item in items"
        :key="item.word"
        class="bank-word"
        :class="{ 'is-selected': selectedSet.has(item.word) }"
        :data-word="item.word"
      >
        <label class="word-check">
          <input
            type="checkbox"
            :checked="selectedSet.has(item.word)"
            :aria-label="`选择 ${item.word}`"
            @change="emit('toggle', item)"
          />
        </label>

        <div class="word-main">
          <p class="word-title">{{ item.word }}</p>
          <p class="word-phonetic">
            <span v-for="part in partsOf(item)" :key="part.label" class="phonetic-part">
              {{ part.label }} {{ part.value }}
            </span>
            <span v-if="!partsOf(item).length" class="phonetic-empty">—</span>
          </p>
        </div>

        <div class="word-summary">
          <p>{{ item.summary || '暂无释义' }}</p>
          <p v-if="item.senses?.length > 1" class="sense-more">
            共 {{ item.senses.length }} 个义项
          </p>
        </div>

        <span class="word-rank">{{ item.rank }}</span>

        <div class="word-state">
          <template v-if="tab === 'imported'">
            <StatusPill
              v-if="item.personalStudyState"
              kind="status"
              :value="item.personalStudyState"
            />
            <span v-else class="state-note">不在个人词库</span>
          </template>
          <span v-else-if="item.inLibrary" class="state-existing">已在词库（原有）</span>
          <span v-else class="state-new">未导入</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.bank-word-table {
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.list-head,
.bank-word {
  display: grid;
  grid-template-columns: 28px minmax(140px, 1.1fr) minmax(180px, 1.8fr) 72px minmax(120px, 0.9fr);
  align-items: center;
  gap: var(--space-3);
  padding: 10px var(--space-5);
}

.list-head {
  border-bottom: 1px solid var(--color-line);
  background: var(--color-bg-deep);
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.bank-word-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.bank-word {
  border-bottom: 1px solid var(--color-line);
  transition: background-color var(--dur-fast) var(--ease-out);
}

.bank-word:last-child {
  border-bottom: 0;
}

.bank-word:hover {
  background: color-mix(in srgb, var(--color-bg-deep) 52%, var(--color-surface));
}

.bank-word.is-selected {
  background: color-mix(in srgb, var(--color-primary-ink) 6%, var(--color-surface));
}

.word-check {
  display: flex;
  align-items: center;
  justify-content: center;
}

.word-check input {
  width: 15px;
  height: 15px;
  accent-color: var(--color-primary-ink);
  cursor: pointer;
}

.word-title {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-reading);
  font-size: var(--text-body);
  line-height: var(--leading-body);
  overflow-wrap: anywhere;
}

.word-phonetic {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.word-summary {
  min-width: 0;
  color: var(--color-ink);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.word-summary p {
  margin: 0;
  overflow-wrap: anywhere;
}

.sense-more {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.word-rank {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  font-variant-numeric: tabular-nums;
}

.word-state {
  display: flex;
  align-items: center;
  gap: 6px;
}

.state-existing,
.state-new,
.state-note {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  white-space: nowrap;
}

.state-existing {
  background: var(--color-bg-deep);
  color: var(--color-muted);
}

.state-new {
  background: color-mix(in srgb, var(--color-primary-ink) 10%, transparent);
  color: var(--color-primary-ink);
}

.state-note {
  color: var(--color-muted);
}

@media (max-width: 767px) {
  .list-head {
    display: none;
  }

  .bank-word {
    grid-template-columns: 24px minmax(0, 1fr) auto;
    grid-template-areas:
      'check main rank'
      'check summary summary'
      'check state state';
    gap: 4px var(--space-3);
    padding: var(--space-3) var(--space-4);
  }

  .word-check {
    grid-area: check;
    align-self: start;
    padding-top: 2px;
  }

  .word-main {
    grid-area: main;
  }

  .word-summary {
    grid-area: summary;
  }

  .word-rank {
    grid-area: rank;
    align-self: start;
  }

  .word-state {
    grid-area: state;
    margin-top: 4px;
  }
}
</style>
