<script setup>
/**
 * 生词容忍开关
 *
 * 用途：medium / hard 下控制请求体的 allowNewWords（后端 md/41、md/42）。
 *       值有三态：null = 自动（最终模式默认开、其余关），true / false 为用户显式选择。
 *       界面显示「最终生效的值」，用户点一下才落成显式布尔值；没动过就保持自动。
 * 用法：<AllowNewWordsPicker v-model="draft.allowNewWords" :budget="3" :auto-on="isFinalMode" />
 *
 * props:
 *   modelValue — null（自动）/ true / false；刻意不声明 Boolean 类型，
 *                否则 Vue 会把 null 强转成 false，丢掉「自动」这一态
 *   budget     — /capacity 的 levels[level].unknownBudget，只是上限、不保证出现
 *   autoOn     — 自动口径下是否为开（最终模式），仅用于显示与初始勾选
 *   disabled   — 生成中禁用
 * emits:
 *   update:modelValue — 显式布尔值（用户点击后永远不再是 null）
 */
import { computed } from 'vue'

const props = defineProps({
  modelValue: { default: null },
  budget: { type: Number, default: null },
  autoOn: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

// null 是「自动」：最终模式默认开，其余难度默认关
const checked = computed(() => (props.modelValue === null ? props.autoOn : props.modelValue))

const hint = computed(() => {
  const budget = props.budget

  if (!checked.value) return '只用你认识的词，不出现词表之外的词'

  // 「允许」不是「保证」：额度只是上限，提示词不会告诉模型该用几个
  if (props.modelValue === null && props.autoOn) {
    return budget > 0
      ? `最终模式默认开启，最多 ${budget} 个生词（只是上限，不保证出现）`
      : '最终模式默认开启'
  }

  return budget > 0 ? `最多 ${budget} 个生词，只是上限，不保证出现` : '偶尔出现少量生词'
})

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !checked.value)
}
</script>

<template>
  <div class="allow-row">
    <span id="allow-new-words-label" class="row-label">生词容忍</span>

    <div class="allow-body">
      <button
        type="button"
        role="switch"
        class="toggle"
        :class="{ 'is-on': checked }"
        :aria-checked="checked"
        aria-labelledby="allow-new-words-label"
        aria-describedby="allow-new-words-hint"
        :disabled="disabled"
        @click="toggle"
      >
        <span class="track" aria-hidden="true">
          <span class="thumb" />
        </span>
        <span class="toggle-text">允许偶尔出现少量生词</span>
      </button>

      <p id="allow-new-words-hint" class="allow-hint">{{ hint }}</p>
    </div>
  </div>
</template>

<style scoped>
.allow-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
}

.row-label {
  flex: 0 0 100px;
  padding-top: 2px;
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.allow-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
}

.toggle:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 4px;
  border-radius: var(--radius-sm);
}

.toggle:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.track {
  position: relative;
  flex: 0 0 auto;
  width: 38px;
  height: 22px;
  border-radius: var(--radius-pill);
  background: var(--color-line-strong);
  transition: background-color var(--dur-fast) var(--ease-out);
}

.toggle.is-on .track {
  background: var(--color-primary);
}

.thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  transition: transform var(--dur-fast) var(--ease-out);
}

.toggle.is-on .thumb {
  transform: translateX(16px);
}

.toggle-text {
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.allow-hint {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

@media (max-width: 767px) {
  .row-label {
    flex-basis: 88px;
  }

  /* 触控目标不小于 44px */
  .toggle {
    min-height: 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .track,
  .thumb {
    transition: none;
  }
}
</style>
