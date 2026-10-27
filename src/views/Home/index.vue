<script setup>
/**
 * 首页视图
 * F1 呈现 Hero 与三个入口的静态骨架；F4 接入词汇总数、未设置/空词库分支与生成流程。
 */
import { ArrowRight, BookOpen, NotebookPen, Sparkles } from 'lucide-vue-next'
import heroDesk from '../../assets/images/hero-desk.png'

const entries = [
  {
    to: '/words',
    icon: BookOpen,
    title: '我的单词',
    desc: '管理你的词汇库。添加、编辑或删除单词。',
  },
  {
    to: '/settings',
    icon: NotebookPen,
    title: '阅读设置',
    desc: '选择难度、文章长度和题目数量。',
  },
  {
    to: '/settings',
    icon: Sparkles,
    title: '开始阅读',
    desc: 'AI 为你生成专属阅读材料，开启你的学习之旅。',
  },
]
</script>

<template>
  <section class="home">
    <div class="hero">
      <div class="hero-copy">
        <p class="page-eyebrow">AI Reading Practice</p>
        <h1 class="hero-title">Word Reading</h1>
        <p class="hero-subtitle">用你所学的单词，读懂更大的世界</p>
        <p class="hero-desc">
          基于你的词汇库，生成专属英文阅读材料，在阅读中巩固单词，提升英语能力。
        </p>
      </div>

      <figure class="hero-figure">
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

    <div class="entries">
      <RouterLink v-for="entry in entries" :key="entry.title" class="entry" :to="entry.to">
        <span class="entry-icon" aria-hidden="true">
          <component :is="entry.icon" :size="20" :stroke-width="1.6" />
        </span>
        <span class="entry-title">{{ entry.title }}</span>
        <span class="entry-desc">{{ entry.desc }}</span>
        <ArrowRight class="entry-arrow" :size="18" :stroke-width="1.6" aria-hidden="true" />
      </RouterLink>
    </div>
  </section>
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

.entries {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
  margin-top: var(--space-10);
}

.entry {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 168px;
  padding: var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
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

@media (max-width: 1023px) {
  .hero {
    grid-template-columns: 1fr;
    gap: var(--space-6);
  }

  .hero-figure {
    height: 240px;
  }

  .entries {
    gap: var(--space-4);
  }
}

@media (max-width: 767px) {
  .hero-title {
    font-size: 40px;
    line-height: 48px;
  }

  .hero-figure {
    height: 200px;
  }

  .entries {
    grid-template-columns: 1fr;
    margin-top: var(--space-8);
  }
}
</style>
