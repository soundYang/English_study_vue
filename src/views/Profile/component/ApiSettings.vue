<script setup>
/**
 * API 设置卡
 *
 * 用途：个人中心右栏，说明模型服务由服务端统一配置。
 *       按后端 md/33 §2.2 / §13-3，个人 API（baseURL + key）本期不做，
 *       这里不展示任何密钥，也不提供一个点了没反应的「重置」。
 * 用法：<ApiSettings />
 */
import { Link2, RotateCcw } from 'lucide-vue-next'
import BaseButton from '../../../component/BaseButton.vue'
</script>

<template>
  <section class="settings-card" aria-labelledby="api-settings-title">
    <header class="card-head">
      <span class="card-icon" aria-hidden="true">
        <Link2 :size="18" :stroke-width="1.8" />
      </span>
      <h2 id="api-settings-title" class="card-title">API 设置</h2>
      <span class="card-badge">暂未开放</span>
    </header>

    <ul class="setting-list">
      <li class="setting-row">
        <span class="row-icon" aria-hidden="true">
          <Link2 :size="17" :stroke-width="1.8" />
        </span>
        <span class="row-copy">
          <span class="row-title-line">
            <span class="row-title">模型服务</span>
            <span class="row-state">
              <span class="state-dot" aria-hidden="true" />
              由服务端配置
            </span>
          </span>
          <span class="row-desc">密钥由服务端统一保管，个人中心不读取、也不保存 API Key。</span>
        </span>
      </li>

      <li class="setting-row">
        <span class="row-icon" aria-hidden="true">
          <RotateCcw :size="17" :stroke-width="1.8" />
        </span>
        <span class="row-copy">
          <span class="row-title">重置 API</span>
          <span class="row-desc">个人 API 配置暂未开放，没有可重置的密钥。</span>
        </span>
        <BaseButton size="sm" variant="secondary" disabled aria-label="重置 API（暂未开放）">
          重置
        </BaseButton>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.settings-card {
  padding: var(--space-5) var(--space-6) var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.card-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
}

.card-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--color-bg-deep);
  color: var(--color-primary);
}

.card-title {
  font-family: var(--font-display);
  font-size: var(--text-card-title);
  line-height: var(--leading-card-title);
  letter-spacing: 0.02em;
}

.card-badge {
  margin-left: auto;
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  background: var(--color-bg-deep);
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.setting-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 64px;
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-line);
}

.row-icon {
  display: grid;
  flex: 0 0 30px;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--color-bg-deep);
  color: var(--color-ink-2);
}

.row-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.row-title-line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.row-title {
  color: var(--color-ink);
  font-size: var(--text-body);
  line-height: 24px;
}

.row-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--color-success-bg);
  color: var(--color-success);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.state-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.row-desc {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

@media (max-width: 767px) {
  .settings-card {
    padding: var(--space-4) var(--space-5) var(--space-2);
  }

  .setting-row {
    gap: var(--space-2);
  }

  .row-desc {
    /* 手机宽度下说明文字允许换行，不截断关键信息 */
    white-space: normal;
  }
}
</style>
