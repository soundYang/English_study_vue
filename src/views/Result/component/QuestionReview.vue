<script setup>
/**
 * 单题解析卡
 * 展示题号、题干、用户答案、对错状态；答错时补充正确答案与解析。
 * 解析下方再展示原文依据（evidence）：后端只从正文原样复制一句，
 * 老文档为空串，此时整块不渲染。
 * 状态同时使用图标、文字与颜色，避免只靠颜色传达。
 *
 * 用法：<ol><QuestionReview v-for="..." :question="question" :result="result" :index="0" /></ol>
 *
 * props:
 *   question — { id, question, options }
 *   result   — { questionId, selectedOption, correctAnswer, isCorrect, explanation, evidence? }
 *   index    — 从 0 开始的题序，用于编号与 stagger
 */
import { computed } from 'vue'
import { Check, X } from 'lucide-vue-next'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const props = defineProps({
  question: { type: Object, required: true },
  result: { type: Object, required: true },
  index: { type: Number, default: 0 },
})

/** 选项下标 → “B. A friend”；越界或未作答时安全降级 */
function formatOption(value, options) {
  if (value === null || value === undefined) return '未作答'

  const optionIndex = Number(value)
  if (
    !Number.isInteger(optionIndex) ||
    !Array.isArray(options) ||
    optionIndex < 0 ||
    optionIndex >= options.length
  ) {
    return String(value)
  }

  const letter = LETTERS[optionIndex] || String(optionIndex + 1)
  return `${letter}. ${options[optionIndex]}`
}

const isCorrect = computed(() => Boolean(props.result.isCorrect))
const isUnanswered = computed(
  () => props.result.selectedOption === null || props.result.selectedOption === undefined,
)
const selectedText = computed(() =>
  formatOption(props.result.selectedOption, props.question.options),
)
const correctText = computed(() => formatOption(props.result.correctAnswer, props.question.options))
const explanation = computed(() => String(props.result.explanation || '').trim())
const evidence = computed(() => String(props.result.evidence || '').trim())
const staggerStyle = computed(() => ({ animationDelay: `${Math.min(props.index, 7) * 40}ms` }))
</script>

<template>
  <li class="review-card" :class="{ 'is-wrong': !isCorrect }" :style="staggerStyle">
    <div class="review-head">
      <span class="review-number">第 {{ index + 1 }} 题</span>
      <span class="review-status" :class="isCorrect ? 'is-correct' : 'is-wrong'">
        <Check v-if="isCorrect" :size="14" aria-hidden="true" />
        <X v-else :size="14" aria-hidden="true" />
        {{ isCorrect ? '回答正确' : '回答错误' }}
      </span>
    </div>

    <p class="review-question">{{ question.question }}</p>

    <div class="review-answers">
      <p class="answer-line">
        你的答案：<span class="answer-value" :class="{ 'is-empty': isUnanswered }">{{
          selectedText
        }}</span>
      </p>
      <p v-if="!isCorrect" class="answer-line is-correct-answer">
        正确答案：<span class="answer-value">{{ correctText }}</span>
      </p>
    </div>

    <p v-if="explanation" class="review-explanation">{{ explanation }}</p>

    <div v-if="evidence" class="review-evidence">
      <p class="review-evidence-label">原文依据</p>
      <blockquote class="review-evidence-text">{{ evidence }}</blockquote>
    </div>
  </li>
</template>

<style scoped>
.review-card {
  padding: var(--space-5);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  animation: review-in var(--dur-base) var(--ease-out) both;
}

.review-card.is-wrong {
  border-color: var(--color-danger-bg);
  border-left: 3px solid var(--color-danger);
  background: var(--color-danger-bg);
}

.review-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.review-number {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  letter-spacing: 0.04em;
}

.review-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  white-space: nowrap;
}

.review-status.is-correct {
  color: var(--color-success);
}

.review-status.is-wrong {
  color: var(--color-danger);
}

.review-question {
  margin-top: var(--space-2);
  color: var(--color-ink);
  font-size: 15px;
  font-weight: 500;
  line-height: 24px;
  overflow-wrap: anywhere;
}

.review-answers {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: var(--space-3);
}

.answer-line {
  color: var(--color-ink-2);
  font-size: 14px;
  line-height: 22px;
  overflow-wrap: anywhere;
}

.answer-value {
  font-weight: 500;
}

.answer-value.is-empty {
  color: var(--color-muted);
  font-weight: 400;
}

.is-correct-answer {
  color: var(--color-success);
}

.is-correct-answer .answer-value {
  color: var(--color-success);
}

.review-explanation {
  margin-top: var(--space-3);
  padding-left: var(--space-3);
  border-left: 2px solid var(--color-line-strong);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  overflow-wrap: anywhere;
}

.review-evidence {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
}

.review-evidence-label {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.review-evidence-text {
  margin: 2px 0 0;
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  overflow-wrap: anywhere;
}

@keyframes review-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 767px) {
  .review-card {
    padding: var(--space-4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .review-card {
    animation: none;
  }
}
</style>
