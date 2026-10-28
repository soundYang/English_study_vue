<script setup>
/**
 * 词源多选
 *
 * 用途：“词源”行标签 + 今天新学 / 今天复习 / 全部词汇三个可多选的标签。
 *       「全部词汇」与另外两项互斥（与后端 normalizeScope 同义）：
 *       点 all 清掉其余，点具体项清掉 all，全去掉时回到 all——后端不接受空数组。
 * 用法：<ScopePicker v-model="draft.vocabScope" :disabled="isGenerating" />
 *
 * props:
 *   modelValue — 词源数组，如 ['all'] 或 ['today_new', 'today_reviewed']
 *   disabled   — 生成中禁用整组
 * emits:
 *   update:modelValue — 词源变化，始终是非空数组
 */
import { computed } from 'vue'
import { normalizeVocabScope, VOCAB_SCOPE_LABELS, VOCAB_SCOPES } from '../../../unit/validators'

const OPTIONS = VOCAB_SCOPES.map((value) => ({ value, label: VOCAB_SCOPE_LABELS[value] }))

const props = defineProps({
  modelValue: { type: Array, required: true },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

// 归一化后再判断勾选：外部传进 ['all', 'today_new'] 这类脏组合也显示成「全选」
const selected = computed(() => normalizeVocabScope(props.modelValue))

function isChecked(value) {
  return selected.value.includes(value)
}

function toggle(value) {
  if (props.disabled) return

  if (value === 'all') {
    emit('update:modelValue', ['all'])
    return
  }

  // 取消最后一个具体项等于什么都没选，回落到全量而不是发空数组
  if (isChecked(value)) {
    const next = selected.value.filter((item) => item !== value)
    emit('update:modelValue', next.length ? next : ['all'])
    return
  }

  emit('update:modelValue', [...selected.value.filter((item) => item !== 'all'), value])
}
</script>

<template>
  <div class="scope-row">
    <span id="vocab-scope-label" class="row-label">词源</span>
    <div class="scope-group" role="group" aria-labelledby="vocab-scope-label">
      <button
        v-for="option in OPTIONS"
        :key="option.value"
        type="button"
        role="checkbox"
        class="scope-chip"
        :class="{ 'is-active': isChecked(option.value) }"
        :aria-checked="isChecked(option.value)"
        :disabled="disabled"
        @click="toggle(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.scope-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.row-label {
  flex: 0 0 100px;
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.scope-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

/* 多选标签各自带边框：单选那套共用滑动指示器在这里会同时指向两个选项 */
.scope-chip {
  height: 32px;
  padding: 0 var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-pill);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  white-space: nowrap;
  transition:
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}

.scope-chip:hover:not(:disabled):not(.is-active) {
  border-color: var(--color-line-strong);
  color: var(--color-ink-2);
}

.scope-chip.is-active {
  border-color: var(--color-primary);
  background: var(--color-surface);
  color: var(--color-ink);
  font-weight: 500;
}

.scope-chip:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.scope-chip:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 767px) {
  .row-label {
    flex-basis: 88px;
  }

  /* 触控目标不小于 44px */
  .scope-chip {
    height: 44px;
  }
}
</style>
