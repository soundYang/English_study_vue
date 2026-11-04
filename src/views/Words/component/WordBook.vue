<script setup>
/**
 * 单词书（翻书 / 拼贴两种形态）
 *
 * 用途：把当前页的单词摊成一本书——左页 6 条、右页 6 条，页角翻页；
 *       拼贴模式把同一批词平铺成卡片墙。两种形态共享筛选、页码与选择状态（md/55 §3）。
 * 用法：<WordBook :items="store.items" :page="store.page" :total="store.total"
 *          @prev="..." @next="..." @open="..." @select="..." />
 *
 * props:
 *   items        — 当前页词条（最多 12 条）
 *   total        — 当前筛选下的总数
 *   page         — 当前页（从 1 开始）
 *   pageSize     — 每页条数，默认 12；左页取前一半，右页取后一半
 *   mode         — book（翻书）/ collage（拼贴）
 *   loading      — 首次加载：书页上出现淡墨骨架
 *   error        — 请求失败：书页中间显示错误卡
 *   masked       — 游客态：词条用遮罩
 *   selectable   — 是否显示复选框与「全选本页」
 *   selectedIds  — 已选中的 id 数组
 *   highlightId  — 新增 / 编辑后短暂高亮的 id
 *   activeWord   — 详情纸页当前展示的词，列表里留一道下划线
 * emits:
 *   prev / next         — 翻页
 *   retry               — 错误卡重试
 *   select              — 勾选单条，参数 { id, selected }
 *   select-all          — 全选 / 取消全选当前这一摊，参数为布尔值
 *   open / edit / remove — 词条动作，参数为词对象
 *   login               — 游客点击遮罩
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import BaseButton from '../../../component/BaseButton.vue'
import SkeletonBlock from '../../../component/SkeletonBlock.vue'
import WordEntry from './WordEntry.vue'

const PER_PAGE = 6

const props = defineProps({
  items: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 12 },
  mode: { type: String, default: 'book' },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  masked: { type: Boolean, default: false },
  selectable: { type: Boolean, default: false },
  selectedIds: { type: Array, default: () => [] },
  highlightId: { type: String, default: '' },
  activeWord: { type: String, default: '' },
})

const emit = defineEmits([
  'prev',
  'next',
  'retry',
  'select',
  'select-all',
  'open',
  'edit',
  'remove',
  'login',
])

const flip = ref('')
let flipTimer = null

const selectedSet = computed(() => new Set(props.selectedIds))
const allSelected = computed(
  () => props.items.length > 0 && props.items.every((item) => selectedSet.value.has(item.id)),
)
const someSelected = computed(() => props.items.some((item) => selectedSet.value.has(item.id)))
const allIndeterminate = computed(
  () => props.selectable && someSelected.value && !allSelected.value,
)

const leftItems = computed(() => props.items.slice(0, PER_PAGE))
const rightItems = computed(() => props.items.slice(PER_PAGE, PER_PAGE * 2))

// 物理页号：一摊两页；总页数按每页 6 条算
const leftPageNo = computed(() => (props.page - 1) * 2 + 1)
const rightPageNo = computed(() => (props.page - 1) * 2 + 2)
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / PER_PAGE)))
const canPrev = computed(() => props.page > 1)
const canNext = computed(() => props.page * props.pageSize < props.total)

// 游客态也需要一个稳定的 key 与词形占位，但不显示任何真实数据
const maskedItems = computed(() =>
  Array.from({ length: PER_PAGE }, (_, index) => ({
    id: `masked-${index}`,
    word: '',
    phonetic: null,
    senses: [],
    studyState: 'new',
    source: 'dictionary',
    createdAt: null,
    wordBanks: [],
  })),
)

const displayLeft = computed(() => (props.masked ? maskedItems.value : leftItems.value))
const displayRight = computed(() => (props.masked ? maskedItems.value : rightItems.value))

function flipTo(direction) {
  flip.value = direction
  clearTimeout(flipTimer)
  flipTimer = setTimeout(() => {
    flip.value = ''
    flipTimer = null
  }, 420)
}

watch(
  () => props.page,
  (next, previous) => {
    flipTo(next >= previous ? 'next' : 'prev')
  },
)

function handleKeydown(event) {
  const target = event.target
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  ) {
    return
  }

  if (event.key === 'ArrowLeft' && canPrev.value) {
    event.preventDefault()
    emit('prev')
  } else if (event.key === 'ArrowRight' && canNext.value) {
    event.preventDefault()
    emit('next')
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  clearTimeout(flipTimer)
})

function toggleAll(event) {
  emit('select-all', event.target.checked)
}

function toggleOne(payload) {
  emit('select', payload)
}
</script>

<template>
  <section
    class="word-book"
    :class="[`is-${mode}`, { 'is-flipping': flip }]"
    role="region"
    aria-label="单词书"
    :aria-busy="loading ? 'true' : 'false'"
  >
    <div v-if="error" class="book-error" role="alert">
      <p class="error-title">词汇加载失败</p>
      <p class="error-desc">{{ error }}</p>
      <BaseButton variant="secondary" @click="emit('retry')">重试</BaseButton>
    </div>

    <!-- 拼贴模式：同一批词平铺成卡片墙 -->
    <div v-else-if="mode === 'collage'" class="collage">
      <div v-if="loading && !items.length" class="collage-grid" aria-hidden="true">
        <div v-for="row in 8" :key="`collage-skeleton-${row}`" class="collage-card is-skeleton">
          <SkeletonBlock width="52%" height="18px" />
          <SkeletonBlock width="72%" height="12px" />
          <SkeletonBlock width="44%" height="12px" />
        </div>
      </div>

      <ul v-else class="collage-grid">
        <WordEntry
          v-for="item in displayLeft.concat(displayRight)"
          :key="item.id"
          :item="item"
          :selected="selectedSet.has(item.id)"
          :highlight="item.id === highlightId"
          :active="item.word === activeWord"
          :selectable="selectable"
          :masked="masked"
          @open="emit('open', $event)"
          @edit="emit('edit', $event)"
          @remove="emit('remove', $event)"
          @select="toggleOne"
          @login="emit('login')"
        />
      </ul>
    </div>

    <!-- 翻书模式：摊开的双页 -->
    <div v-else class="book-spread" :class="flip ? `is-${flip}` : ''">
      <div class="book-page book-page--left">
        <header class="page-head">
          <label v-if="selectable && !masked" class="page-select">
            <input
              type="checkbox"
              class="row-check"
              :checked="allSelected"
              :indeterminate.prop="allIndeterminate"
              aria-label="全选本页"
              @change="toggleAll"
            />
            <span>全选本页</span>
          </label>
          <span v-else class="page-spacer" aria-hidden="true" />
          <span class="page-no">第 {{ leftPageNo }} 页</span>
        </header>

        <ul v-if="masked || !loading || items.length" class="entry-list">
          <WordEntry
            v-for="item in displayLeft"
            :key="item.id"
            :item="item"
            :selected="selectedSet.has(item.id)"
            :highlight="item.id === highlightId"
            :active="item.word === activeWord"
            :selectable="selectable"
            :masked="masked"
            @open="emit('open', $event)"
            @edit="emit('edit', $event)"
            @remove="emit('remove', $event)"
            @select="toggleOne"
            @login="emit('login')"
          />
        </ul>

        <div v-else class="entry-skeleton" aria-hidden="true">
          <div v-for="row in PER_PAGE" :key="`skeleton-${row}`" class="skeleton-line">
            <SkeletonBlock width="46%" height="16px" />
            <SkeletonBlock width="70%" height="12px" />
          </div>
        </div>

        <footer class="page-foot">
          <button
            type="button"
            class="page-corner"
            :disabled="!canPrev"
            aria-label="上一页"
            @click="emit('prev')"
          >
            <ChevronLeft :size="16" :stroke-width="2" aria-hidden="true" />
          </button>
          <span class="page-count">{{ leftPageNo }} / {{ totalPages }}</span>
        </footer>
      </div>

      <div class="book-page book-page--right">
        <header class="page-head">
          <span class="page-spacer" aria-hidden="true" />
          <span class="page-no">第 {{ rightPageNo }} 页 · 共 {{ totalPages }} 页</span>
        </header>

        <ul v-if="masked || !loading || items.length" class="entry-list">
          <WordEntry
            v-for="item in displayRight"
            :key="item.id"
            :item="item"
            :selected="selectedSet.has(item.id)"
            :highlight="item.id === highlightId"
            :active="item.word === activeWord"
            :selectable="selectable"
            :masked="masked"
            @open="emit('open', $event)"
            @edit="emit('edit', $event)"
            @remove="emit('remove', $event)"
            @select="toggleOne"
            @login="emit('login')"
          />
          <li
            v-if="!masked && !loading && !rightItems.length"
            class="page-blank"
            aria-hidden="true"
          >
            这一页还空着
          </li>
        </ul>

        <div v-else class="entry-skeleton" aria-hidden="true">
          <div v-for="row in PER_PAGE" :key="`skeleton-right-${row}`" class="skeleton-line">
            <SkeletonBlock width="46%" height="16px" />
            <SkeletonBlock width="70%" height="12px" />
          </div>
        </div>

        <footer class="page-foot">
          <span class="page-count">{{ rightPageNo }} / {{ totalPages }}</span>
          <button
            type="button"
            class="page-corner"
            :disabled="!canNext"
            aria-label="下一页"
            @click="emit('next')"
          >
            <ChevronRight :size="16" :stroke-width="2" aria-hidden="true" />
          </button>
        </footer>
      </div>
    </div>
  </section>
</template>

<style scoped>
.word-book {
  min-width: 0;
}

/* ---------- 翻书模式 ---------- */

.book-spread {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0;
  border: 1px solid var(--color-line-strong);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

/* 书脊：两页之间的径向阴影 + 1px 折线 */
.book-spread::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  z-index: 2;
  width: 24px;
  content: '';
  background: linear-gradient(
    to right,
    rgb(44 74 59 / 0%),
    rgb(44 74 59 / 10%) 45%,
    rgb(44 74 59 / 10%) 55%,
    rgb(44 74 59 / 0%)
  );
  transform: translateX(-50%);
  pointer-events: none;
}

.book-page {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 540px;
  padding: var(--space-4) var(--space-5) var(--space-3);
}

.book-page--left {
  border-right: 1px solid var(--color-line);
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 30px;
  margin-bottom: var(--space-2);
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.page-select {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease-out);
}

.word-book:hover .page-select,
.page-select:focus-within,
.page-select:has(input:checked) {
  opacity: 1;
}

.row-check {
  width: 15px;
  height: 15px;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.page-spacer {
  display: block;
  height: 1px;
}

.page-no {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.entry-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.page-blank {
  display: grid;
  flex: 1;
  place-items: center;
  color: var(--color-line-strong);
  font-family: var(--font-reading);
  font-size: var(--text-small);
}

.page-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--color-line);
}

.page-corner {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  color: var(--color-ink-2);
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.page-corner:hover:not(:disabled) {
  background: var(--color-bg-deep);
  color: var(--color-ink);
}

.page-corner:disabled {
  color: var(--color-line-strong);
  cursor: not-allowed;
}

.page-corner:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.page-count {
  color: var(--color-muted);
  font-family: var(--font-reading);
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
}

.entry-skeleton {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  padding-top: var(--space-2);
}

.skeleton-line {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-line);
}

/* 翻页：只翻一张纸，幅度小，避免廉价 3D 感 */
.book-spread.is-next .book-page--right,
.book-spread.is-prev .book-page--left {
  animation: page-turn 420ms var(--ease-out);
}

.book-spread.is-next .book-page--right {
  transform-origin: left center;
}

.book-spread.is-prev .book-page--left {
  transform-origin: right center;
}

@keyframes page-turn {
  0% {
    opacity: 0.55;
    transform: perspective(1400px) rotateY(0deg);
  }

  55% {
    opacity: 0.85;
    transform: perspective(1400px) rotateY(-5deg);
  }

  100% {
    opacity: 1;
    transform: perspective(1400px) rotateY(0deg);
  }
}

.book-spread.is-prev .book-page--left {
  animation-name: page-turn-back;
}

@keyframes page-turn-back {
  0% {
    opacity: 0.55;
    transform: perspective(1400px) rotateY(0deg);
  }

  55% {
    opacity: 0.85;
    transform: perspective(1400px) rotateY(5deg);
  }

  100% {
    opacity: 1;
    transform: perspective(1400px) rotateY(0deg);
  }
}

/* ---------- 拼贴模式 ---------- */

.collage-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.collage :deep(.word-entry) {
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.collage :deep(.word-entry:last-child) {
  border-bottom: 1px solid var(--color-line);
}

.collage :deep(.entry-check) {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  margin: 0;
}

.collage :deep(.entry-menu) {
  position: absolute;
  right: var(--space-2);
  bottom: var(--space-2);
}

.collage :deep(.entry-body) {
  gap: 6px;
}

.collage :deep(.entry-sub) {
  gap: 6px;
}

.collage-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

/* ---------- 状态 ---------- */

.book-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-10) var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  text-align: center;
}

.error-title {
  color: var(--color-ink-2);
  font-size: 16px;
  font-weight: 500;
  line-height: 26px;
}

.error-desc {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  overflow-wrap: anywhere;
}

@media (max-width: 1279px) {
  .collage-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1023px) {
  .book-spread {
    grid-template-columns: minmax(0, 1fr);
  }

  .book-spread::before {
    display: none;
  }

  .book-page {
    min-height: 0;
  }

  .book-page--left {
    border-right: 0;
    border-bottom: 1px dashed var(--color-line);
  }
}

@media (max-width: 767px) {
  .book-page {
    padding: var(--space-3) var(--space-3) var(--space-2);
  }

  .collage-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (hover: none) {
  .page-select {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .book-spread.is-next .book-page--right,
  .book-spread.is-prev .book-page--left {
    animation: page-fade 200ms linear;
  }

  @keyframes page-fade {
    from {
      opacity: 0.7;
    }

    to {
      opacity: 1;
    }
  }
}
</style>
