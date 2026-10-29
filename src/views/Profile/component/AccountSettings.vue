<script setup>
/**
 * 账户设置卡
 *
 * 用途：个人中心左栏，提供修改昵称、修改密码、意见反馈与退出登录四个入口
 * 用法：<AccountSettings :nickname="user.nickname" @edit-nickname="editOpen = true" @change-password="passwordOpen = true" @feedback="feedbackOpen = true" @logout="handleLogout" />
 *
 * props:
 *   nickname — 当前昵称，显示在「修改昵称」说明里
 * emits:
 *   edit-nickname / change-password / feedback / logout
 */
import { ChevronRight, LockKeyhole, LogOut, MessageSquareText, UserRound } from 'lucide-vue-next'

defineProps({
  nickname: { type: String, default: '' },
})

const emit = defineEmits(['edit-nickname', 'change-password', 'feedback', 'logout'])
</script>

<template>
  <section class="settings-card" aria-labelledby="account-settings-title">
    <header class="card-head">
      <span class="card-icon" aria-hidden="true">
        <UserRound :size="18" :stroke-width="1.8" />
      </span>
      <h2 id="account-settings-title" class="card-title">账户设置</h2>
    </header>

    <ul class="setting-list">
      <li>
        <button class="setting-row" type="button" @click="emit('edit-nickname')">
          <span class="row-icon" aria-hidden="true">
            <UserRound :size="17" :stroke-width="1.8" />
          </span>
          <span class="row-copy">
            <span class="row-title">修改昵称</span>
            <span class="row-desc">当前：{{ nickname || '—' }}</span>
          </span>
          <ChevronRight class="row-arrow" :size="16" aria-hidden="true" />
        </button>
      </li>

      <li>
        <button class="setting-row" type="button" @click="emit('change-password')">
          <span class="row-icon" aria-hidden="true">
            <LockKeyhole :size="17" :stroke-width="1.8" />
          </span>
          <span class="row-copy">
            <span class="row-title">修改密码</span>
            <span class="row-desc">定期更换密码，保障账户安全</span>
          </span>
          <ChevronRight class="row-arrow" :size="16" aria-hidden="true" />
        </button>
      </li>

      <li>
        <button class="setting-row" type="button" @click="emit('feedback')">
          <span class="row-icon" aria-hidden="true">
            <MessageSquareText :size="17" :stroke-width="1.8" />
          </span>
          <span class="row-copy">
            <span class="row-title">意见反馈</span>
            <span class="row-desc">遇到问题或有建议，告诉我们</span>
          </span>
          <ChevronRight class="row-arrow" :size="16" aria-hidden="true" />
        </button>
      </li>

      <li>
        <button class="setting-row is-logout" type="button" @click="emit('logout')">
          <span class="row-icon" aria-hidden="true">
            <LogOut :size="17" :stroke-width="1.8" />
          </span>
          <span class="row-copy">
            <span class="row-title">退出登录</span>
            <span class="row-desc">退出当前账号，回到登录页</span>
          </span>
          <ChevronRight class="row-arrow" :size="16" aria-hidden="true" />
        </button>
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

.setting-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 64px;
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-line);
  text-align: left;
  transition: color var(--dur-fast) var(--ease-out);
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
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.row-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.row-title {
  color: var(--color-ink);
  font-size: var(--text-body);
  line-height: 24px;
}

.row-desc {
  overflow: hidden;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-arrow {
  flex: 0 0 auto;
  color: var(--color-muted-2);
  transition: transform var(--dur-fast) var(--ease-out);
}

.setting-row:hover .row-icon {
  background: var(--color-primary);
  color: var(--color-primary-ink);
}

.setting-row:hover .row-arrow {
  transform: translateX(2px);
}

.setting-row.is-logout:hover .row-icon {
  background: var(--color-danger);
  color: var(--color-danger-ink);
}

.setting-row.is-logout:hover .row-title {
  color: var(--color-danger);
}

@media (max-width: 767px) {
  .settings-card {
    padding: var(--space-4) var(--space-5) var(--space-2);
  }
}
</style>
