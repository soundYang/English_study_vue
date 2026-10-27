<script setup>
/**
 * 首页入口卡
 *
 * 用途：统一三张入口卡的图标底块、标题、描述、右下角箭头与悬停位移。
 *       传 to 时渲染为 RouterLink；不传 to 时渲染为 button，由父级处理点击。
 * 用法：<EntryCard title="我的单词" desc="..." :icon="BookOpen" to="/words" />
 *       <EntryCard title="开始阅读" desc="..." :icon="Sparkles" @select="startReading" />
 *
 * props:
 *   title — 卡片标题
 *   desc  — 描述文案
 *   icon  — lucide 图标组件
 *   to    — 目标路由；为空时渲染按钮
 *   meta  — 描述下方的小字（如“已收录 24 个单词”）
 *   delay — 入场动画延迟毫秒数，基准 200ms
 * emits:
 *   select — 无 to 时点击触发
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight } from 'lucide-vue-next'

const props = defineProps({
  title: { type: String, required: true },
  desc: { type: String, required: true },
  icon: { type: [Object, Function], required: true },
  to: { type: String, default: '' },
  meta: { type: String, default: '' },
  delay: { type: Number, default: 0 },
})

const emit = defineEmits(['select'])

const tag = computed(() => (props.to ? RouterLink : 'button'))
const linkProps = computed(() => (props.to ? { to: props.to } : {}))
const entryStyle = computed(() => ({ '--entry-delay': `${200 + props.delay}ms` }))

function handleClick() {
  if (!props.to) emit('select')
}
</script>

<template>
  <component
    :is="tag"
    v-bind="linkProps"
    :type="to ? undefined : 'button'"
    class="entry"
    :style="entryStyle"
    @click="handleClick"
  >
    <span class="entry-icon" aria-hidden="true">
      <component :is="icon" :size="20" :stroke-width="1.6" />
    </span>
    <span class="entry-title">{{ title }}</span>
    <span class="entry-desc">{{ desc }}</span>
    <span v-if="meta" class="entry-meta">{{ meta }}</span>
    <ArrowRight class="entry-arrow" :size="18" :stroke-width="1.6" aria-hidden="true" />
  </component>
</template>

<style scoped>
.entry {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  min-height: 168px;
  padding: var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-ink);
  text-align: left;
  animation: entry-rise var(--dur-page) var(--ease-out) both;
  animation-delay: var(--entry-delay, 200ms);
  transition:
    transform 180ms var(--ease-out),
    border-color 180ms var(--ease-out),
    box-shadow 180ms var(--ease-out);
}

.entry:hover {
  border-color: var(--color-line-strong);
  box-shadow: var(--shadow-md);
  transform: translateY(-3px);
}

.entry-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--color-bg-deep);
  color: var(--color-primary);
}

.entry-title {
  margin-top: var(--space-4);
  font-size: var(--text-card-title);
  font-weight: 500;
  line-height: var(--leading-card-title);
}

.entry-desc {
  max-width: 26ch;
  margin-top: var(--space-1);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.entry-meta {
  margin-top: var(--space-1);
  color: var(--color-accent);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.entry-arrow {
  position: absolute;
  right: var(--space-5);
  bottom: var(--space-5);
  color: var(--color-accent);
  transition: transform var(--dur-fast) var(--ease-out);
}

.entry:hover .entry-arrow {
  transform: translateX(4px);
}

@keyframes entry-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .entry {
    animation-delay: 0ms !important;
  }
}
</style>
