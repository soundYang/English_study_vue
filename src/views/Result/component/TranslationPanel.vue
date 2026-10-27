<script setup>
/**
 * 中文翻译折叠卡
 * 桌面端默认展开、移动端默认折叠；超过约 8 行（约 240 字）才显示折叠按钮。
 * 内容始终完整保留在 DOM 中，通过 max-height 过渡折叠，不影响复制与读屏。
 *
 * 用法：<TranslationPanel :translation="result.translation" />
 *
 * props:
 *   translation — 已提交结果中的中文翻译
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { useMediaQuery } from '../../../composables/useMediaQuery'

const LONG_THRESHOLD = 240
const COLLAPSED_HEIGHT = 224

const props = defineProps({
  translation: { type: String, default: '' },
})

const isMobile = useMediaQuery('(max-width: 767px)')

const contentRef = ref(null)
const contentHeight = ref(2000)
const measuredLong = ref(false)
const touched = ref(false)
const expanded = ref(!isMobile.value)

const text = computed(() => String(props.translation || '').trim())
const isLong = computed(() => text.value.length > LONG_THRESHOLD || measuredLong.value)
const isCollapsed = computed(() => isLong.value && !expanded.value)

const contentStyle = computed(() => {
  if (!isLong.value) return {}
  return {
    maxHeight: isCollapsed.value
      ? `${COLLAPSED_HEIGHT}px`
      : `${Math.max(contentHeight.value, COLLAPSED_HEIGHT)}px`,
  }
})

// 首帧后按实际高度校正字符数近似值，兼容中英混排
async function measure() {
  await nextTick()

  const element = contentRef.value
  if (!element || !element.scrollHeight) return

  contentHeight.value = Math.max(element.scrollHeight, COLLAPSED_HEIGHT)
  if (element.scrollHeight > COLLAPSED_HEIGHT + 1) measuredLong.value = true
}

function toggle() {
  touched.value = true
  expanded.value = !expanded.value
}

onMounted(measure)

watch(text, measure)

// 用户手动切换后不再跟随断点，避免旋转屏幕把选择覆盖掉
watch(isMobile, (mobile) => {
  if (!touched.value) expanded.value = !mobile
})
</script>

<template>
  <section class="translation-card">
    <h2 class="translation-title">中文翻译</h2>

    <div
      id="result-translation-body"
      ref="contentRef"
      class="translation-body"
      :class="{ 'is-collapsed': isCollapsed }"
      :style="contentStyle"
    >
      <p class="translation-text">{{ text }}</p>
    </div>

    <button
      v-if="isLong"
      type="button"
      class="translation-toggle"
      :aria-expanded="expanded"
      aria-controls="result-translation-body"
      @click="toggle"
    >
      <span>{{ expanded ? '收起翻译' : '展开翻译' }}</span>
      <ChevronDown
        class="toggle-icon"
        :class="{ 'is-rotated': expanded }"
        :size="16"
        aria-hidden="true"
      />
    </button>
  </section>
</template>

<style scoped>
.translation-card {
  padding: var(--space-8);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

.translation-title {
  font-family: var(--font-display);
  font-size: var(--text-section);
  line-height: var(--leading-section);
  letter-spacing: 0.02em;
}

.translation-body {
  position: relative;
  margin-top: var(--space-4);
  overflow: hidden;
  transition: max-height 220ms var(--ease-in-out);
}

.translation-text {
  color: var(--color-ink-2);
  font-size: var(--text-body);
  line-height: 28px;
  overflow-wrap: anywhere;
}

.translation-body.is-collapsed::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 48px;
  background: linear-gradient(to bottom, transparent, var(--color-surface));
  content: '';
  pointer-events: none;
}

.translation-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: var(--space-3);
  padding: var(--space-1) 0;
  border: none;
  background: none;
  color: var(--color-primary);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.translation-toggle:hover {
  color: var(--color-primary-hover);
}

.toggle-icon {
  transition: transform 180ms var(--ease-out);
}

.toggle-icon.is-rotated {
  transform: rotate(180deg);
}

@media (max-width: 767px) {
  .translation-card {
    padding: var(--space-5);
    border-radius: var(--radius-lg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .translation-body,
  .toggle-icon {
    transition: none;
  }
}
</style>
