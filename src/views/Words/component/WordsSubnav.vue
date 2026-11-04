<script setup>
/**
 * 单词模块子导航
 *
 * 用途：在「我的单词 / 词库」之间切换；只出现在单词模块的三个页面，
 *       不进入全局侧栏，避免导航再加一层（md/55 §2.2）。
 * 用法：<WordsSubnav />
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// /words/banks 也以 /words 开头，不能靠前缀判断，直接看是否进入词库路由
const isBanks = computed(() => route.path.startsWith('/words/banks'))
</script>

<template>
  <nav class="words-subnav" aria-label="单词模块">
    <RouterLink
      to="/words"
      class="subnav-item"
      :class="{ 'is-active': !isBanks }"
      :aria-current="!isBanks ? 'page' : undefined"
    >
      我的单词
    </RouterLink>
    <RouterLink
      to="/words/banks"
      class="subnav-item"
      :class="{ 'is-active': isBanks }"
      :aria-current="isBanks ? 'page' : undefined"
    >
      词库
    </RouterLink>
  </nav>
</template>

<style scoped>
.words-subnav {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
}

.subnav-item {
  padding: 5px 14px;
  border-radius: var(--radius-pill);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  text-decoration: none;
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.subnav-item:hover {
  color: var(--color-ink);
}

.subnav-item.is-active {
  background: var(--color-primary);
  color: var(--color-primary-ink);
}

.subnav-item:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
</style>
