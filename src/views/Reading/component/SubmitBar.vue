<script setup>
/**
 * 提交区
 *
 * 用途：提示提交后的可见内容、已答进度与提交按钮；移动端固定底部
 * 用法：<SubmitBar :answered="3" :total="5" :submitting="false" @submit="beginSubmit" />
 *
 * props:
 *   answered   — 已作答题数
 *   total      — 总题数
 *   submitting — 批改中
 *   disabled   — 其他原因禁用
 * emits:
 *   submit
 */
import BaseButton from '../../../component/BaseButton.vue'

defineProps({
  answered: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  submitting: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['submit'])
</script>

<template>
  <footer class="submit-bar">
    <div class="submit-copy">
      <p class="submit-tip">提交后将显示答案、中文翻译和解析。</p>
      <p class="submit-progress">
        已答 <strong>{{ answered }}</strong> / {{ total }}
      </p>
    </div>
    <BaseButton
      class="submit-button"
      size="lg"
      :loading="submitting"
      :disabled="disabled || submitting"
      @click="emit('submit')"
    >
      {{ submitting ? '批改中…' : '提交答案' }}
    </BaseButton>
  </footer>
</template>

<style scoped>
.submit-bar {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-5);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-line);
}

.submit-copy {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.submit-tip {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.submit-progress {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  white-space: nowrap;
}

.submit-progress strong {
  color: var(--color-accent);
  font-family: var(--font-display);
  font-weight: 500;
}

.submit-button {
  width: 100%;
}

@media (max-width: 767px) {
  .submit-bar {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: var(--z-topbar);
    margin: 0;
    padding: var(--space-3) var(--space-5) calc(var(--space-3) + env(safe-area-inset-bottom));
    border-top: 1px solid var(--color-line);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
  }

  .submit-bar .submit-button {
    height: 44px;
  }
}
</style>
