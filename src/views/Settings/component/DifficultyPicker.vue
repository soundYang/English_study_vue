<script setup>
/**
 * 难度整卡选择器
 *
 * 用途：三张难度素材图整卡单选。图片内已含标题、描述与箭头，外层只负责选中描边、
 *       勾选徽标、键盘方向键与读屏标签。
 *       每张卡下面一行预检结论（还差多少认识词 / 该档最多写多少词），不可用的难度**不禁用**：
 *       难度三档常常一起不够（新用户），禁用后连「看看别的档」都做不到，
 *       而点了仍然会得到一条带补救动作的错误提示。
 * 用法：<DifficultyPicker v-model="draft.level" :gates="capacity?.levels" :disabled="isGenerating" />
 *
 * props:
 *   modelValue — 当前难度 easy / medium / hard
 *   disabled   — 生成中禁用整组
 *   gates      — /capacity 的 levels 原样传入；缺省时所有卡都不显示结论
 * emits:
 *   update:modelValue — 选中难度变化
 */
import { computed, ref } from 'vue'
import { Check } from 'lucide-vue-next'
import easyImage from '../../../assets/images/difficulty-easy.png'
import mediumImage from '../../../assets/images/difficulty-medium.png'
import hardImage from '../../../assets/images/difficulty-hard.png'
import { difficultyNoteOf } from '../../../unit/capacity'

const options = [
  {
    value: 'easy',
    image: easyImage,
    width: 367,
    height: 574,
    label: '简单：短句为主，句式重复，适合初学者建立信心',
  },
  {
    value: 'medium',
    image: mediumImage,
    width: 364,
    height: 572,
    label: '进阶：增加句子连接和人物互动，让单词在更多语境中出现',
  },
  {
    value: 'hard',
    image: hardImage,
    width: 375,
    height: 581,
    label: '挑战：更长的文章、更多的情节，在复杂的语境中理解词汇',
  },
]

const props = defineProps({
  modelValue: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  gates: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:modelValue'])

const cardRefs = ref([])

// 认识词不够是根本问题，优先说它；篇幅上限只是「切过去会自动缩短」。
// 判断放在 unit/capacity.js：md/30 §7 删掉了 knownSufficient / knownShortage，
// 现在要按 minKnown 与 knownWords 现算
function noteOf(value) {
  return difficultyNoteOf(props.gates?.[value])
}

const cards = computed(() => options.map((option) => ({ ...option, note: noteOf(option.value) })))

function setCardRef(element, index) {
  if (element) cardRefs.value[index] = element
}

function select(value) {
  if (props.disabled || value === props.modelValue) return
  emit('update:modelValue', value)
}

function handleKeydown(event) {
  if (props.disabled) return

  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
  if (!keys.includes(event.key)) return

  event.preventDefault()
  const count = options.length
  const current = Math.max(
    0,
    options.findIndex((option) => option.value === props.modelValue),
  )
  let next = current

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % count
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + count) % count
  if (event.key === 'Home') next = 0
  if (event.key === 'End') next = count - 1

  select(options[next].value)
  cardRefs.value[next]?.focus()
}
</script>

<template>
  <fieldset class="difficulty" :disabled="disabled">
    <legend class="section-title">1. 选择难度</legend>

    <div class="cards" role="radiogroup" aria-label="选择难度" @keydown="handleKeydown">
      <div v-for="(card, index) in cards" :key="card.value" class="card-item">
        <button
          :ref="(element) => setCardRef(element, index)"
          type="button"
          role="radio"
          class="card"
          :class="{ 'is-selected': card.value === modelValue }"
          :aria-checked="card.value === modelValue"
          :aria-label="card.note ? `${card.label}（${card.note}）` : card.label"
          :tabindex="card.value === modelValue ? 0 : -1"
          :disabled="disabled"
          @click="select(card.value)"
        >
          <img
            :src="card.image"
            alt=""
            :width="card.width"
            :height="card.height"
            loading="lazy"
            draggable="false"
            @dragstart.prevent
          />
          <span v-if="card.value === modelValue" class="badge" aria-hidden="true">
            <Check :size="14" :stroke-width="2.6" />
          </span>
        </button>

        <!-- 不可用的难度只说缘由，不禁用：三档常常一起不够，禁了就一步也走不了 -->
        <p v-if="card.note" class="card-note">{{ card.note }}</p>
      </div>
    </div>
  </fieldset>
</template>

<style scoped>
.difficulty {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.section-title {
  padding: 0;
  font-family: var(--font-display);
  font-size: var(--text-section);
  line-height: var(--leading-section);
  letter-spacing: 0.02em;
}

.cards {
  display: grid;
  /*
   * 按三张原图的宽高比分列宽：0.639 / 0.636 / 0.645（367×574、364×572、375×581），
   * 缩放后三卡高度齐平，宽度也随之保持原有比例
   */
  grid-template-columns: minmax(0, 639fr) minmax(0, 636fr) minmax(0, 645fr);
  gap: var(--space-4);
  /* 宽屏时不再跟着左栏无限放大，整行收到 700px，页面高度随之变矮 */
  max-width: 700px;
  margin-top: var(--space-4);
}

/* 卡片 + 下方一行预检结论：结论跟着卡片同宽，窄屏换行而不是撑宽整行 */
.card-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.card-note {
  color: var(--color-warning);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  text-align: center;
}

.card {
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  border-radius: var(--radius-lg);
  background: transparent;
  /* 点按立即触发 click，不再等双击缩放判定；长按也不弹系统菜单 */
  touch-action: manipulation;
  -webkit-touch-callout: none;
  user-select: none;
  transition:
    transform 180ms var(--ease-out),
    box-shadow 180ms var(--ease-out);
}

.card img {
  width: 100%;
  height: auto;
  border-radius: var(--radius-lg);
  /*
   * 素材图只是卡片内容，不该自己成为点按 / 长按目标：
   * 部分手机浏览器会把「点图片」当成看图并全屏预览。让触点落在整卡按钮上，
   * 选中逻辑仍由 button 的 click 处理
   */
  pointer-events: none;
  -webkit-touch-callout: none;
  -webkit-user-drag: none;
  user-select: none;
}

.card:hover:not(.is-selected):not(:disabled) {
  box-shadow: var(--shadow-md);
  transform: translateY(-3px);
}

.card.is-selected {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
}

.card:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 4px;
}

.card:disabled {
  cursor: not-allowed;
}

.badge {
  position: absolute;
  top: 10px;
  right: 10px;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-primary-ink);
  box-shadow: var(--shadow-sm);
  animation: badge-in 180ms var(--ease-spring) both;
}

@keyframes badge-in {
  from {
    opacity: 0;
    transform: scale(0.6);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (max-width: 767px) {
  .cards {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .card-item {
    max-width: 280px;
  }
}
</style>
