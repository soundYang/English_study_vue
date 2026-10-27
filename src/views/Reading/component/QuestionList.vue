<script setup>
/**
 * 题目列表
 *
 * 用途：渲染全部题卡，并把单题选择事件向上抛出
 * 用法：<QuestionList ref="listRef" :questions="questions" :answers="answers"
 *          :disabled="submitting" @select="(id, option) => setAnswer(id, option)" />
 *
 * props:
 *   questions — 题目数组
 *   answers   — { [questionId]: selectedOption }
 *   disabled  — 提交中禁用选项
 * emits:
 *   select — (questionId, optionIndex)
 */
import QuestionCard from './QuestionCard.vue'

defineProps({
  questions: { type: Array, default: () => [] },
  answers: { type: Object, default: () => ({}) },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

function select(questionId, optionIndex) {
  emit('select', questionId, optionIndex)
}
</script>

<template>
  <ul class="question-list">
    <QuestionCard
      v-for="(question, index) in questions"
      :key="question.id"
      :question="question"
      :index="index"
      :selected="answers[question.id] ?? null"
      :disabled="disabled"
      @select="select(question.id, $event)"
    />
  </ul>
</template>

<style scoped>
.question-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
