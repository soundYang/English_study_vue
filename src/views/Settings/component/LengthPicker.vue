<script setup>
/**
 * 文章长度选择器
 *
 * 用途：三个预设胶囊（约 100 / 150 / 200 词）+ 选中胶囊内的 10 词步进器；
 *       选中胶囊里的词数可直接输入，失焦或回车时取整到 10 并夹在
 *       100～当前难度上限之间；范围与步长同后端 targetWordsRules。
 * 用法：<LengthPicker v-model="draft.targetWords" :max="lengthMax" :disabled="isGenerating" />
 *
 * props:
 *   modelValue — 当前目标词数（10 的倍数）
 *   disabled   — 生成中禁用
 *   max        — 当前难度的篇幅上限，缺省时用全局上限
 * emits:
 *   update:modelValue — 词数变化（只在回车 / 失焦 / 点步进或预设时发出）
 */
import { computed, ref, watch } from 'vue'
import { Minus, Plus } from 'lucide-vue-next'
import { TARGET_WORDS_MAX, TARGET_WORDS_MIN, TARGET_WORDS_STEP } from '../../../unit/validators'

const PRESETS = [100, 150, 200]
// 四位足够覆盖 1000 词的最终模式；超出的按键直接丢掉
const INPUT_MAX_LENGTH = 4

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
// 组件内部以 currentValue 为准：输入框刚提交、父组件还没回传新 props 时，
// 紧接着点「+」也要基于新值计算，不能拿旧的 props.modelValue 加 10
const currentValue = ref(props.modelValue)
const inputText = ref(String(props.modelValue))
const isEditing = ref(false)

const canDecrease = computed(() => currentValue.value > TARGET_WORDS_MIN)
const canIncrease = computed(() => currentValue.value < props.max)

watch(
  () => props.modelValue,
  (value) => {
    currentValue.value = value

    if (!isEditing.value) inputText.value = String(value)

    const index = PRESETS.indexOf(value)
    if (index >= 0) activeIndex.value = index
  },
)

function clamp(value) {
  return Math.min(props.max, Math.max(TARGET_WORDS_MIN, value))
}

/** 先取整到 10 的倍数再夹上限：上限本身也是 10 的倍数（300 / 450 / 600） */
function normalize(value) {
  return clamp(Math.round(value / TARGET_WORDS_STEP) * TARGET_WORDS_STEP)
}

function emitValue(next) {
  // 与当前值相同时不发事件，避免无谓地触发一次预检
  if (next === currentValue.value) return

  currentValue.value = next
  emit('update:modelValue', next)
}

// 预设始终渲染，超出当前难度上限的置灰而不是过滤掉：
// activeIndex 是 PRESETS 的下标，过滤后的数组下标会和它对不上
function isPresetDisabled(preset) {
  return props.disabled || preset > props.max
}

function choosePreset(value, index) {
  if (props.disabled) return

  activeIndex.value = index
  inputText.value = String(value)
  emitValue(value)
}

function step(delta) {
  if (props.disabled) return

  const next = clamp(currentValue.value + delta)
  emitValue(next)

  if (isEditing.value) inputText.value = String(next)
}

function startEditing(event) {
  isEditing.value = true
  // 短数字字段：聚焦即全选，直接输入就能覆盖，不用先删三次
  event?.target?.select?.()
}

function handleInput(event) {
  // 只保留数字：type=number 允许 e / + / -，校验反而更麻烦，也用不上
  const cleaned = String(event.target.value || '')
    .replace(/\D/g, '')
    .slice(0, INPUT_MAX_LENGTH)

  event.target.value = cleaned
  inputText.value = cleaned
  isEditing.value = true
}

/** 回车 / 失焦时落值；空值或非法输入退回当前值，不弹错误 */
function commitInput() {
  const parsed = Number(inputText.value)

  isEditing.value = false

  if (!inputText.value || !Number.isFinite(parsed)) {
    inputText.value = String(currentValue.value)
    return
  }

  const next = normalize(parsed)
  inputText.value = String(next)
  emitValue(next)
}

/** Esc 放弃这次输入 */
function cancelInput() {
  isEditing.value = false
  inputText.value = String(currentValue.value)
}

function handleSpinKeydown(event) {
  if (props.disabled) return

  if (event.key === 'Enter') {
    // 这个组件在 <form> 里，不拦的话回车会直接触发生成
    event.preventDefault()
    commitInput()
    event.target.blur()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelInput()
    event.target.blur()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    step(TARGET_WORDS_STEP)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    step(-TARGET_WORDS_STEP)
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

          <span class="value">
            <span class="value-affix" aria-hidden="true">约</span>
            <input
              class="value-input"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              :maxlength="INPUT_MAX_LENGTH"
              :value="inputText"
              :disabled="disabled"
              :aria-label="`文章长度（词），可手动输入，${TARGET_WORDS_MIN} 到 ${max}`"
              title="可直接输入，按 10 词取整"
              @focus="startEditing"
              @input="handleInput"
              @keydown="handleSpinKeydown"
              @blur="commitInput"
            />
            <span class="value-affix" aria-hidden="true">词</span>
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 74px;
  padding: 0 2px;
  color: var(--color-ink);
  font-size: var(--text-small);
  font-weight: 500;
  line-height: var(--leading-small);
  font-variant-numeric: tabular-nums;
}

.value-affix {
  color: var(--color-muted);
  font-weight: 400;
}

.value-input {
  width: 4ch;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: center;
  cursor: text;
}

.value-input:focus-visible {
  border-radius: var(--radius-sm);
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.value-input:disabled {
  color: var(--color-muted);
  cursor: not-allowed;
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
