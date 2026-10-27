<script setup>
/**
 * 首页 Hero 区
 *
 * 用途：左侧产品文案 + 右侧书桌实景图卡，文案三段错峰淡入、图片延迟 80ms 淡入
 * 用法：<HeroPanel />
 */
import heroDesk from '../../../assets/images/hero-desk.png'
</script>

<template>
  <div class="hero">
    <div class="hero-copy">
      <p class="page-eyebrow rise" style="--rise-delay: 0ms">AI Reading Practice</p>
      <h1 class="hero-title rise" style="--rise-delay: 60ms">Word Reading</h1>
      <p class="hero-subtitle rise" style="--rise-delay: 120ms">用你所学的单词，读懂更大的世界</p>
      <p class="hero-desc rise" style="--rise-delay: 120ms">
        基于你的词汇库，生成专属英文阅读材料，在阅读中巩固单词，提升英语能力。
      </p>
    </div>

    <figure class="hero-figure rise" style="--rise-delay: 80ms">
      <img
        :src="heroDesk"
        alt="阳光洒在书桌上，摊开的书本旁放着写有鼓励话语的便签"
        width="1672"
        height="941"
        fetchpriority="high"
      />
      <figcaption class="hero-quote">Better English,<br />Better You.</figcaption>
    </figure>
  </div>
</template>

<style scoped>
.hero {
  display: grid;
  grid-template-columns: 55% 45%;
  gap: var(--space-10);
  align-items: center;
  min-height: 300px;
}

.hero-title {
  font-family: var(--font-display);
  font-size: var(--text-display);
  line-height: var(--leading-display);
  letter-spacing: 0;
}

.hero-subtitle {
  margin-top: var(--space-3);
  color: var(--color-ink-2);
  font-size: 18px;
  line-height: 30px;
}

.hero-desc {
  max-width: 42ch;
  margin-top: var(--space-3);
  color: var(--color-muted);
  font-size: 14px;
  line-height: 24px;
}

.hero-figure {
  position: relative;
  height: 300px;
  overflow: hidden;
  border-radius: var(--radius-2xl);
  background: var(--color-bg-deep);
}

.hero-figure img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-figure::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(270deg, rgba(20, 28, 24, 0.55), rgba(20, 28, 24, 0) 55%);
  content: '';
}

.hero-quote {
  position: absolute;
  right: var(--space-6);
  bottom: var(--space-5);
  z-index: 1;
  color: var(--color-primary-ink);
  font-family: var(--font-display);
  font-size: 22px;
  font-style: italic;
  line-height: 1.35;
  text-align: right;
  text-shadow: 0 1px 12px rgba(20, 28, 24, 0.35);
}

.rise {
  animation: hero-rise var(--dur-page) var(--ease-out) both;
  animation-delay: var(--rise-delay, 0ms);
}

@keyframes hero-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 768–1023 仍为两栏（平板横屏），只收窄间距并降低标题 */
@media (max-width: 1023px) {
  .hero {
    gap: var(--space-6);
  }

  .hero-title {
    font-size: 44px;
    line-height: 52px;
  }

  .hero-figure {
    height: 240px;
  }
}

/* 小于 768 才上下堆叠 */
@media (max-width: 767px) {
  .hero {
    grid-template-columns: 1fr;
  }

  .hero-title {
    font-size: 40px;
    line-height: 48px;
  }

  .hero-figure {
    height: 200px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rise {
    animation-delay: 0ms !important;
  }
}
</style>
