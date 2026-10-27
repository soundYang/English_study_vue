<script setup>
/**
 * 阅读答题视图
 * F1 占位：F6 接入安全 DTO、双栏阅读、计时、作答与提交。
 */
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <section class="page">
    <p class="page-eyebrow">Reading · {{ route.params.id }}</p>
    <h1 class="page-title">阅读答题</h1>
    <p class="page-desc">在无答案、无翻译的安全状态下完成阅读与作答。</p>

    <div class="panel-placeholder">
      <strong>F6 · 答题页</strong>
      <span>这里将展示文章卡、题目面板、建议用时倒计时与提交区。</span>
    </div>
  </section>
</template>
