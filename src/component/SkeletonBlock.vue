<script setup>
/**
 * 骨架块
 *
 * 用途：加载占位，1.4s 微光循环；减少动效模式下自动静止
 * 用法：<SkeletonBlock height="20px" width="60%" />
 *       <SkeletonBlock width="40px" height="40px" circle />
 *
 * props:
 *   width / height — CSS 尺寸字符串
 *   radius         — 圆角，默认 var(--radius-sm)
 *   circle         — 圆形占位
 */
defineProps({
  width: { type: String, default: '100%' },
  height: { type: String, default: '16px' },
  radius: { type: String, default: 'var(--radius-sm)' },
  circle: { type: Boolean, default: false },
})
</script>

<template>
  <span
    class="skeleton-block"
    :style="{ width, height, borderRadius: circle ? '50%' : radius }"
    aria-hidden="true"
  />
</template>

<style scoped>
.skeleton-block {
  position: relative;
  display: block;
  overflow: hidden;
  background: var(--color-bg-deep);
}

.skeleton-block::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    rgba(255, 252, 246, 0) 0%,
    rgba(255, 252, 246, 0.65) 50%,
    rgba(255, 252, 246, 0) 100%
  );
  content: '';
  transform: translateX(-100%);
  animation: skeleton-shimmer 1.4s linear infinite;
}

@keyframes skeleton-shimmer {
  to {
    transform: translateX(100%);
  }
}
</style>
