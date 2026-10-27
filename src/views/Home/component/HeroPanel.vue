<script setup>
/**
 * 首页 Hero 区
 *
 * 用途：一整幅横屏横幅 —— 书桌实景图铺满整块作为背景层，文案层横向铺满并浮在图片上靠左排布，
 *       左侧用底色渐隐压住画面保证可读；引语落在右上角，文案三段错峰淡入
 * 用法：<HeroPanel />（所在路由需要 meta.flush，否则背景无法贴到窗口右边缘）
 */
import heroDesk from '../../../assets/images/hero-desk.png'
</script>

<template>
  <div class="hero">
    <img class="hero-bg" :src="heroDesk" alt="" width="1672" height="941" fetchpriority="high" />
    <div class="hero-scrim" aria-hidden="true"></div>

    <div class="hero-copy">
      <p class="page-eyebrow rise" style="--rise-delay: 0ms">AI Reading Practice</p>
      <h1 class="hero-title rise" style="--rise-delay: 60ms">Word Reading</h1>
      <p class="hero-subtitle rise" style="--rise-delay: 120ms">用你所学的单词，读懂更大的世界</p>
      <p class="hero-desc rise" style="--rise-delay: 120ms">
        基于你的词汇库，生成专属英文阅读材料，在阅读中巩固单词，提升英语能力。
      </p>
    </div>

    <p class="hero-quote">Better English,<br />Better You.</p>
  </div>
</template>

<style scoped>
/* 整块横屏：背景图与遮罩绝对定位，文案层铺满整行并垂直居中 */
.hero {
  position: relative;
  display: grid;
  align-items: stretch;
  min-height: clamp(380px, 46vh, 520px);
  overflow: hidden;
  background: var(--color-bg-deep);
}

.hero-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* 底板与书架留在画面右侧，左侧窗边交给遮罩压住 */
  object-position: right center;
  animation: hero-fade var(--dur-slow) var(--ease-out) both;
}

/*
 * 文案压在照片上，左侧用底色由实到虚，保证文字始终落在干净区域；
 * 渐变按内容左侧留白 + 固定像素推进，窄屏收窄时也不会把文字露在画面上。
 */
.hero-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    var(--color-bg) 0,
    var(--color-bg) calc(var(--content-pad-x) + 440px),
    color-mix(in srgb, var(--color-bg) 55%, transparent) calc(var(--content-pad-x) + 560px),
    transparent calc(var(--content-pad-x) + 720px)
  );
}

.hero-copy {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  padding: var(--content-pad-y) var(--content-pad-x);
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

/*
 * 设计稿里引语落在画面右上的留白处；这张实景图右缘是书架与垂吊植物，
 * 所以让出 26% 停在干净墙面上，深色字不再压在书脊上
 */
.hero-quote {
  position: absolute;
  top: 20%;
  right: 26%;
  z-index: 2;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 24px;
  font-style: italic;
  line-height: 1.4;
  text-align: right;
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

@keyframes hero-fade {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

/* 768–1023 仍为整幅横幅，只压缩标题与引语字号 */
@media (max-width: 1023px) {
  .hero {
    min-height: 360px;
  }

  .hero-title {
    font-size: 44px;
    line-height: 52px;
  }

  .hero-quote {
    font-size: 20px;
  }
}

/* 小于 768：文案会纵向变高，图片退回文案下方的横条，不再垫在文字底下 */
@media (max-width: 767px) {
  .hero {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .hero-bg {
    position: relative;
    inset: auto;
    order: 2;
    height: 220px;
    object-position: center 62%;
  }

  /* 横条右半是浅色桌面，底部压一层暗角给白色引语让出对比 */
  .hero-scrim {
    inset: auto 0 0;
    height: 96px;
    background: linear-gradient(180deg, transparent, var(--color-overlay));
  }

  .hero-copy {
    order: 1;
    padding: var(--content-pad-y) var(--content-pad-x) var(--space-6);
  }

  .hero-title {
    font-size: 40px;
    line-height: 48px;
  }

  .hero-quote {
    top: auto;
    right: var(--content-pad-x);
    bottom: var(--space-4);
    color: var(--color-primary-ink);
    font-size: 20px;
    text-shadow: 0 1px 14px var(--color-overlay);
  }
}

@media (prefers-reduced-motion: reduce) {
  .rise,
  .hero-bg {
    animation-delay: 0ms !important;
  }
}
</style>
