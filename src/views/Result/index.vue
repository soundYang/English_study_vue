<script setup>
/**
 * 练习结果视图
 * F1 占位：F7 接入成绩环、逐题解析、中文翻译与再练一次。
 */
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <section class="page">
    <p class="page-eyebrow">Result · {{ route.params.id }}</p>
    <h1 class="page-title">练习结果</h1>
    <p class="page-desc">查看得分、逐题对错、正确答案、解析与中文翻译。</p>

    <div class="panel-placeholder">
      <strong>F7 · 结果页</strong>
      <span>这里将展示环形分数、成绩文案、题目解析与翻译折叠面板。</span>
    </div>
  </section>
</template>
