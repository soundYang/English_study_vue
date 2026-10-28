<script setup>
/**
 * 文章长度选择器
 *
 * 用途：横向滑杆 + 可输入的词数 + 10 词步进按钮；
 *       滑杆与步进实时更新，手动输入在回车 / 失焦时取整到 10，
 *       范围 100～当前难度上限；hard 未解锁最终模式时，滑杆尾部把
 *       601–1000 画成一段不可拖的灰区，并写明解锁条件。
 * 用法：<LengthPicker v-model="draft.targetWords" :max="lengthMax" :final-mode="levelFinalMode" />
 *
 * props:
 *   modelValue — 当前目标词数（10 的倍数）
 *   disabled   — 生成中禁用
 *   max        — 当前难度**当前可用**的篇幅上限（未解锁最终模式时是 600）
 *   finalMode  — levels[level].finalMode + 顶层 maxTargetWords；null 表示不展示最终模式
 * emits:
 *   update:modelValue — 词数变化（输入框只在回车 / 失焦时发出）
 */
import { computed, ref, watch } from 'vue'
import { Minus, Plus } from 'lucide-vue-next'
import { finalModeNoteOf } from '../../../unit/capacity'
import { TARGET_WORDS_MAX, TARGET_WORDS_MIN, TARGET_WORDS_STEP } from '../../../unit/validators'

// 四位足够覆盖 1000 词的最终模式；超出的按键直接丢掉
const INPUT_MAX_LENGTH = 4

const props = defineProps({
  modelValue: { type: Number, required: true },
  disabled: { type: Boolean, default: false },
  // 难度上限，由设置页从 /capacity 传入；未传时用全局上限
  max: { type: Number, default: TARGET_WORDS_MAX },
  // 最终模式：supported / unlocked / unlockAt / shortage / maxTargetWords（1000）
  finalMode: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue'])

// 组件内部以 currentValue 为准：输入框刚提交、父组件还没回传新 props 时，
// 紧接着点「+」或拖滑杆也要基于新值计算，不能拿旧的 props.modelValue 加 10
const currentValue = ref(props.modelValue)
const inputText = ref(String(props.modelValue))
const isEditing = ref(false)

const canDecrease = computed(() => currentValue.value > TARGET_WORDS_MIN)
const canIncrease = computed(() => currentValue.value < props.max)
// 滑杆已走过的一段用主题色填充；纯 CSS 做不到动态进度，只能按当前值算百分比
const fillPercent = computed(() => {
  const span = props.max - TARGET_WORDS_MIN
  if (span <= 0) return 0

  const percent = ((currentValue.value - TARGET_WORDS_MIN) / span) * 100
  return Math.min(100, Math.max(0, percent))
})

// 最终模式的契约上限（1000）；没解锁时 max 还是 600，这段差值就是要画灰区的部分
const finalMax = computed(() => {
  const value = Number(props.finalMode?.maxTargetWords)

  return Number.isFinite(value) && value > props.max ? value : 0
})
// 只有 hard 支持最终模式；easy / medium 的 finalMode.supported 是 false
const lockedFinal = computed(
  () => Boolean(props.finalMode?.supported) && !props.finalMode?.unlocked && finalMax.value > 0,
)
const sliderMax = computed(() => (lockedFinal.value ? finalMax.value : props.max))
// 可拖段占整条滑杆的比例：未解锁时 100–600 只占一段，其余是灰区
const livePercent = computed(() => {
  const span = sliderMax.value - TARGET_WORDS_MIN
  if (span <= 0) return 100

  return Math.min(100, Math.max(0, ((props.max - TARGET_WORDS_MIN) / span) * 100))
})
// 文案统一在 unit/capacity.js，支持 / 未解锁 / 已解锁三种情况都在那里分好
const finalNote = computed(() => finalModeNoteOf(props.finalMode))

watch(
  () => props.modelValue,
  (value) => {
    currentValue.value = value

    if (!isEditing.value) inputText.value = String(value)
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

function step(delta) {
  if (props.disabled) return

  const next = clamp(currentValue.value + delta)
  emitValue(next)

  if (isEditing.value) inputText.value = String(next)
}

function handleSlide(event) {
  if (props.disabled) return

  const next = clamp(Number(event.target.value))
  if (!Number.isFinite(next)) return

  inputText.value = String(next)
  emitValue(next)
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

    <div class="length-control">
      <div class="stepper">
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
      </div>

      <div class="slider">
        <span class="slider-bound" aria-hidden="true">{{ TARGET_WORDS_MIN }}</span>

        <div class="slider-track">
          <div class="slider-live" :style="{ flexBasis: `${livePercent}%` }">
            <input
              class="slider-input"
              type="range"
              :min="TARGET_WORDS_MIN"
              :max="max"
              :step="TARGET_WORDS_STEP"
              :value="currentValue"
              :disabled="disabled"
              :style="{ '--fill': `${fillPercent}%` }"
              :aria-valuetext="`约 ${currentValue} 词`"
              :aria-describedby="finalNote ? 'length-final-note' : undefined"
              aria-labelledby="length-label"
              @input="handleSlide"
            />
          </div>

          <!-- 601–1000 的入口：存在但当前拖不到，等个人词库攒够 3000 词 -->
          <span v-if="lockedFinal" class="slider-locked" aria-hidden="true">最终模式</span>
        </div>

        <span class="slider-bound" aria-hidden="true">{{ sliderMax }}</span>
      </div>

      <p v-if="finalNote" id="length-final-note" class="final-note">{{ finalNote }}</p>
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

.length-control {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3) var(--space-4);
  min-width: 0;
}

.stepper {
  display: flex;
  align-items: center;
  min-height: 36px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
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

.slider {
  display: flex;
  /* 不占满整行：滑杆与步进器连在一起看是一个控件，剩下的留白让它更像
     「长度调节」而不是整页的进度条 */
  flex: 0 1 200px;
  align-items: center;
  gap: var(--space-2);
  min-width: 140px;
}

/* 可拖段与灰区共用一条视觉轨道；两段的比例由内联 flex-basis 决定 */
.slider-track {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
}

.slider-live {
  display: flex;
  align-items: center;
  min-width: 0;
}

/* 601–1000：画出来但不接受拖动，避免用户以为「拖不过去是坏了」 */
.slider-locked {
  display: grid;
  flex: 1;
  place-items: center;
  height: 20px;
  margin-left: 6px;
  overflow: hidden;
  border: 1px dashed var(--color-line-strong);
  border-radius: var(--radius-pill);
  color: var(--color-muted);
  font-size: 10px;
  letter-spacing: 0.02em;
  white-space: nowrap;
  cursor: not-allowed;
}

.final-note {
  /* 整行换到滑杆下方，不挤在步进器与滑杆之间 */
  flex: 0 0 100%;
  margin: 0;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.slider-bound {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  font-variant-numeric: tabular-nums;
}

.slider-input {
  flex: 1;
  min-width: 0;
  height: 28px;
  margin: 0;
  background: transparent;
  cursor: pointer;
  appearance: none;
}

.slider-input::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: var(--radius-pill);
  background: linear-gradient(
    to right,
    var(--color-primary) var(--fill, 0%),
    var(--color-line-strong) var(--fill, 0%)
  );
}

.slider-input::-webkit-slider-thumb {
  width: 18px;
  height: 18px;
  margin-top: -7px;
  border: 2px solid var(--color-surface);
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: var(--shadow-sm);
  appearance: none;
}

.slider-input::-moz-range-track {
  height: 4px;
  border-radius: var(--radius-pill);
  background: linear-gradient(
    to right,
    var(--color-primary) var(--fill, 0%),
    var(--color-line-strong) var(--fill, 0%)
  );
}

.slider-input::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-surface);
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.slider-input:focus-visible {
  border-radius: var(--radius-pill);
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.slider-input:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

@media (max-width: 767px) {
  .length-row {
    align-items: flex-start;
  }

  .row-label {
    flex-basis: 88px;
    padding-top: 8px;
  }

  .slider {
    flex-basis: 100%;
  }
}
</style>
