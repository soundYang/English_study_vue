<script setup>
/**
 * 写入新词纸页
 *
 * 用途：从词书翻进去的一张纸，复用 WordFormPanel 的字段与校验，
 *       顶部提供返回；保存成功后表单自行清空，留在本页方便连续录入（md/55 §3.2 H）。
 * 用法：<WordWritePage :submit-word="handleAdd" @back="..." />
 *
 * props:
 *   submitWord — 与 WordFormPanel 相同：接收完整 payload，返回 { ok, errors?, message? }
 * emits:
 *   back — 返回单词列表
 * expose:
 *   focusWord — 聚焦单词输入框
 */
import { ref } from 'vue'
import { ArrowLeft, PenLine } from 'lucide-vue-next'
import WordFormPanel from './WordFormPanel.vue'

const props = defineProps({
  submitWord: { type: Function, required: true },
})

const emit = defineEmits(['back'])

const panel = ref(null)

// 纸页常驻（v-show），因此不在 onMounted 抢焦点；
// 由父级在点「写入新词」时调用 focusWord，避免页面加载后焦点乱跳
defineExpose({
  focusWord: () => panel.value?.focusWord(),
})
</script>

<template>
  <article class="word-write-page" aria-label="写入新词">
    <header class="write-top">
      <button type="button" class="back-link" @click="emit('back')">
        <ArrowLeft :size="16" :stroke-width="1.8" aria-hidden="true" />
        返回我的单词
      </button>
    </header>

    <div class="write-head">
      <h2 class="write-title">
        <PenLine :size="20" :stroke-width="1.6" aria-hidden="true" />
        写入新词
      </h2>
      <p class="write-desc">单词会统一转为小写保存；命中词库时自动补齐音标与释义。</p>
    </div>

    <WordFormPanel ref="panel" compact :submit-word="props.submitWord" />

    <p class="write-hint">已收录的词会参与阅读生成与复习计划。</p>
  </article>
</template>

<style scoped>
.word-write-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 620px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-8);
  border: 1px solid var(--color-line-strong);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.write-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.back-link {
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

.back-link:hover {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.write-head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-line);
}

.write-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: var(--text-section);
  font-weight: 500;
  line-height: var(--leading-section);
  letter-spacing: 0.02em;
}

.write-desc {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.write-hint {
  padding-top: var(--space-3);
  border-top: 1px dashed var(--color-line);
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

@media (max-width: 767px) {
  .word-write-page {
    padding: var(--space-5);
  }
}
</style>
