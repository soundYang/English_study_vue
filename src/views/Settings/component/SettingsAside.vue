<script setup>
/**
 * 设置页装饰栏
 *
 * 用途：贴住右侧、与内容区等高的整幅插画（远山 + 引语已绘入画面），
 *       纯装饰，读屏忽略；小于 1100px 由页面隐藏。
 * 用法：<SettingsAside />（所在路由需要 meta.flush，否则右侧无法贴边）
 */
</script>

<template>
  <div class="settings-aside" aria-hidden="true"></div>
</template>

<style scoped>
.settings-aside {
  /* 网格项默认拉伸，配合页面的 min-height 铺满整列 */
  background-image: url('../../../assets/images/settings-mountain.jpg');
  background-position: center;
  background-repeat: no-repeat;
  /* cover 让插画撑满整列高度，窄列下横向裁掉两侧，上下不留空带 */
  background-size: cover;
  /* 不贴窗口右缘，与左表单列的留白取同一套宽度（--settings-gutter 由设置页定义） */
  margin-right: var(--settings-gutter, var(--content-pad-x));
}
</style>
