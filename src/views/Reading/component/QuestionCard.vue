<script setup>
/**
 * 单道阅读题卡
 *
 * 用途：题干 + 原生单选选项；已作答时右上角显示绿点
 * 用法：<QuestionCard :question="question" :index="0" :selected="1" :disabled="submitting"
 *          @select="choose" />
 *
 * props:
 *   question — { id, question, options }
 *   index    — 题目序号（0 起）
 *   selected — 当前选中项下标；未作答为 null
 *   disabled — 提交中禁用全部选项
 * emits:
 *   select — 选项下标
 */
const props = defineProps({
  question: { type: Object, required: true },
  index: { type: Number, default: 0 },
  selected: { type: Number, default: null },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

function select(optionIndex) {
  if (props.disabled) return
  emit('select', optionIndex)
}
</script>

<template>
  <li class="question-card" :data-question-id="question.id" :id="`question-${question.id}`">
    <div class="question-head">
      <span class="question-number" aria-hidden="true">{{ index + 1 }}</span>
      <h3 class="question-text">{{ question.question }}</h3>
      <span v-if="selected != null" class="answered-dot">
        <span class="sr-only">已作答</span>
      </span>
    </div>

    <fieldset class="options" :disabled="disabled">
      <legend class="sr-only">第 {{ index + 1 }} 题选项</legend>

      <label
        v-for="(option, optionIndex) in question.options"
        :key="optionIndex"
        class="option"
        :class="{ 'is-selected': selected === optionIndex }"
      >
        <input
          class="option-input"
          type="radio"
          :name="`q-${question.id}`"
          :value="optionIndex"
          :checked="selected === optionIndex"
          :disabled="disabled"
          @change="select(optionIndex)"
        />
        <span class="option-dot" aria-hidden="true">
          <span class="option-dot-core" />
        </span>
        <span class="option-text">{{ option }}</span>
      </label>
    </fieldset>
  </li>
</template>

<style scoped>
.question-card {
  position: relative;
  padding: var(--space-5);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  scroll-margin-top: 88px;
  transition: border-color var(--dur-fast) var(--ease-out);
}

.question-head {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.question-number {
  display: grid;
  flex: 0 0 22px;
  place-items: center;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  border-radius: 50%;
  background: var(--color-bg-deep);
  color: var(--color-ink-2);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.question-text {
  flex: 1;
  padding-right: var(--space-4);
  color: var(--color-ink);
  font-size: 15px;
  font-weight: 500;
  line-height: 24px;
  overflow-wrap: anywhere;
}

.answered-dot {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success);
}

.options {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: var(--space-3) 0 0;
  padding: 0;
  border: 0;
}

.option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background-color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}

.option:hover {
  background: var(--color-surface-2);
}

.option.is-selected {
  border-color: var(--color-primary);
  background: #f5f0e4;
}

.option-input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.option-dot {
  display: grid;
  flex: 0 0 18px;
  place-items: center;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  border: 1.5px solid var(--color-line-strong);
  border-radius: 50%;
  background: var(--color-surface);
  transition: border-color var(--dur-fast) var(--ease-out);
}

.option-dot-core {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
  opacity: 0;
  transform: scale(0.6);
  transition:
    opacity var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}

.option.is-selected .option-dot {
  border-color: var(--color-primary);
}

.option.is-selected .option-dot-core {
  opacity: 1;
  transform: scale(1);
}

.option-input:focus-visible + .option-dot {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.option-text {
  color: var(--color-ink-2);
  font-size: 14px;
  line-height: 22px;
  overflow-wrap: anywhere;
}

.option.is-selected .option-text {
  color: var(--color-ink);
}

fieldset:disabled .option {
  cursor: not-allowed;
  opacity: 0.65;
}

@media (max-width: 767px) {
  .question-card {
    padding: var(--space-4);
  }

  .option {
    min-height: 44px;
  }
}
</style>
