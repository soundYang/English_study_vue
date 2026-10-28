<script setup>
/**
 * 文章长度选择器
 *
 * 用途：三个预设胶囊（约 100 / 150 / 200 词）+ 选中胶囊内的 10 词步进器；
 *       范围 100～当前难度上限，手动调整后胶囊文案实时显示当前值。
 * 用法：<LengthPicker v-model="draft.targetWords" :max="lengthMax" :disabled="isGenerating" />
 *
 * props:
 *   modelValue — 当前目标词数（10 的倍数）
 *   disabled   — 生成中禁用
 *   max        — 当前难度的篇幅上限，缺省时用全局上限
 * emits:
 *   update:modelValue — 词数变化
 */
import { computed, ref, watch } from 'vue'
import { Minus, Plus } from 'lucide-vue-next'
import { TARGET_WORDS_MAX, TARGET_WORDS_MIN, TARGET_WORDS_STEP } from '../../../unit/validators'

const PRESETS = [100, 150, 200]

const props = defineProps({
  modelValue: { type: Number, required: true },
  disabled: { type: Boolean, default: false },
  // 难度上限，由设置页从 /capacity 传入；未传时用全局上限
  max: { type: Number, default: TARGET_WORDS_MAX },
})

const emit = defineEmits(['update:modelValue'])

function nearestPresetIndex(value) {
  return PRESETS.reduce(
    (best, preset, index) => {
      const distance = Math.abs(preset - value)
      return distance < best.distance ? { index, distance } : best
    },
    { index: 0, distance: Number.POSITIVE_INFINITY },
  ).index
}

const activeIndex = ref(nearestPresetIndex(props.modelValue))

const canDecrease = computed(() => props.modelValue > TARGET_WORDS_MIN)
const canIncrease = computed(() => props.modelValue < props.max)

watch(
  () => props.modelValue,
  (value) => {
    const index = PRESETS.indexOf(value)
    if (index >= 0) activeIndex.value = index
  },
)

function clamp(value) {
  return Math.min(props.max, Math.max(TARGET_WORDS_MIN, value))
}

// 预设始终渲染，超出当前难度上限的置灰而不是过滤掉：
// activeIndex 是 PRESETS 的下标，过滤后的数组下标会和它对不上
function isPresetDisabled(preset) {
  return props.disabled || preset > props.max
}

function choosePreset(value, index) {
  if (props.disabled) return
  activeIndex.value = index
  emit('update:modelValue', value)
}

function step(delta) {
  if (props.disabled) return
  emit('update:modelValue', clamp(props.modelValue + delta))
}

function handleSpinKeydown(event) {
  if (props.disabled) return

  if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
    event.preventDefault()
    step(TARGET_WORDS_STEP)
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
    event.preventDefault()
    step(-TARGET_WORDS_STEP)
  } else if (event.key === 'Home') {
    event.preventDefault()
    emit('update:modelValue', TARGET_WORDS_MIN)
  } else if (event.key === 'End') {
    event.preventDefault()
    emit('update:modelValue', props.max)
  }
}
</script>

<template>
  <div class="length-row">
    <span id="length-label" class="row-label">文章长度</span>

    <div class="pills" role="group" aria-labelledby="length-label">
      <div
        v-for="(preset, index) in PRESETS"
        :key="preset"
        class="pill"
        :class="{ 'is-active': index === activeIndex }"
      >
        <template v-if="index === activeIndex">
          <button
            type="button"
            class="step"
            aria-label="减少 10 词"
            :disabled="disabled || !canDecrease"
            @click="step(-TARGET_WORDS_STEP)"
          >
            <Minus :size="14" :stroke-width="2" aria-hidden="true" />
          </button>

          <span
            class="value"
            role="spinbutton"
            :aria-valuemin="TARGET_WORDS_MIN"
            :aria-valuemax="max"
            :aria-valuenow="modelValue"
            :aria-valuetext="`约 ${modelValue} 词`"
            aria-label="文章长度"
            tabindex="0"
            @keydown="handleSpinKeydown"
          >
            约 {{ modelValue }} 词
          </span>

          <button
            type="button"
            class="step"
            aria-label="增加 10 词"
            :disabled="disabled || !canIncrease"
            @click="step(TARGET_WORDS_STEP)"
          >
            <Plus :size="14" :stroke-width="2" aria-hidden="true" />
          </button>
        </template>

        <button
          v-else
          type="button"
          class="preset"
          :aria-label="`选择约 ${preset} 词`"
          :disabled="isPresetDisabled(preset)"
          @click="choosePreset(preset, index)"
        >
          约 {{ preset }} 词
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.length-row {
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

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.pill {
  display: flex;
  align-items: center;
  min-height: 36px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  transition:
    border-color var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out);
}

.pill.is-active {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.preset {
  height: 34px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-pill);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  transition: color var(--dur-fast) var(--ease-out);
}

.preset:hover:not(:disabled) {
  color: var(--color-ink);
}

.step {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: 0 2px;
  border-radius: 50%;
  color: var(--color-ink-2);
  transition: background-color var(--dur-fast) var(--ease-out);
}

.step:hover:not(:disabled) {
  background: var(--color-bg-deep);
}

.step:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.value {
  min-width: 68px;
  font-size: var(--text-small);
  font-weight: 500;
  line-height: var(--leading-small);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.value:focus-visible {
  border-radius: var(--radius-sm);
}

.preset:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 767px) {
  .length-row {
    align-items: flex-start;
  }

  .row-label {
    flex-basis: 88px;
  }
}
</style>
