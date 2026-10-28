<script setup>
/**
 * 个人中心头图
 *
 * 用途：展示头像、昵称、账号与个性签名，铅笔按钮打开资料编辑
 * 用法：<ProfileHero :user="user" @edit="editOpen = true" />
 *
 * props:
 *   user — 当前用户资料（nickname / username / signature）
 * emits:
 *   edit — 点击铅笔按钮
 */
import { computed } from 'vue'
import { Pencil } from 'lucide-vue-next'

const props = defineProps({
  user: { type: Object, required: true },
})

const emit = defineEmits(['edit'])

const displayName = computed(
  () => String(props.user?.nickname || '').trim() || String(props.user?.username || '').trim(),
)
const signature = computed(() => String(props.user?.signature || '').trim())
const username = computed(() => String(props.user?.username || '').trim())
</script>

<template>
  <header class="profile-hero">
    <!-- 山景与飞鸟是装饰，不承载信息：头像与昵称各自可读，读屏跳过这一层 -->
    <div class="hero-scenery" aria-hidden="true">
      <svg viewBox="0 0 520 180" preserveAspectRatio="xMaxYMid slice" focusable="false">
        <path d="M0 152 92 74l62 48 76-72 74 72 66-44 150 74v28H0z" fill="#cfd8c8" opacity="0.55" />
        <path d="M116 162 220 86l70 56 70-44 100 64h60v18H116z" fill="#a9b8a4" opacity="0.5" />
        <path
          d="M298 54q6-6 12 0M318 46q6-6 12 0"
          fill="none"
          stroke="#8a9a88"
          stroke-linecap="round"
          stroke-width="1.6"
        />
      </svg>
    </div>

    <span class="hero-avatar" aria-hidden="true">
      <svg viewBox="0 0 72 72" focusable="false">
        <rect width="72" height="72" fill="#efe8da" />
        <circle cx="52" cy="20" r="7" fill="#d9c7a3" />
        <path d="M0 52 18 30l14 16 12-12 14 16 14-10v32H0z" fill="#b9c4b3" />
        <path d="M0 60 14 44l14 14 14-10 14 12 16-8v20H0z" fill="#8fa08c" />
        <path d="M0 68 20 56l14 10 16-8 22 10v4H0z" fill="#5f7768" />
      </svg>
    </span>

    <div class="hero-info">
      <div class="hero-name-row">
        <p class="hero-name">{{ displayName || '未命名' }}</p>
        <button class="hero-edit" type="button" aria-label="编辑个人资料" @click="emit('edit')">
          <Pencil :size="15" :stroke-width="1.8" aria-hidden="true" />
        </button>
      </div>

      <p class="hero-id">ID: {{ username || '—' }}</p>

      <p v-if="signature" class="hero-signature">「{{ signature }}」</p>
      <p v-else class="hero-signature is-empty">还没有个性签名，点铅笔写一句。</p>
    </div>
  </header>
</template>

<style scoped>
.profile-hero {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  gap: var(--space-6);
  min-height: 184px;
  padding: var(--space-8);
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-xl);
  background: linear-gradient(118deg, var(--color-surface) 0%, #f8f3e8 58%, #f1eddf 100%);
  box-shadow: var(--shadow-sm);
}

.hero-scenery {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 46%;
  opacity: 0.8;
  pointer-events: none;
  mask-image: linear-gradient(90deg, transparent 0%, #000 45%);
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 45%);
}

.hero-scenery svg {
  width: 100%;
  height: 100%;
}

.hero-avatar {
  position: relative;
  z-index: 1;
  display: block;
  flex: 0 0 72px;
  width: 72px;
  height: 72px;
  overflow: hidden;
  border: 3px solid rgba(255, 252, 246, 0.9);
  border-radius: 50%;
  background: var(--color-bg-deep);
  box-shadow: var(--shadow-md);
}

.hero-avatar svg {
  width: 100%;
  height: 100%;
}

.hero-info {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.hero-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.hero-name {
  overflow: hidden;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 28px;
  line-height: 38px;
  letter-spacing: 0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-edit {
  display: grid;
  flex: 0 0 32px;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-line);
  border-radius: 50%;
  background: rgba(255, 252, 246, 0.8);
  color: var(--color-muted);
  transition:
    border-color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.hero-edit:hover {
  border-color: var(--color-line-strong);
  background: var(--color-surface);
  color: var(--color-primary);
}

.hero-id {
  margin-top: var(--space-1);
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  letter-spacing: 0.04em;
}

.hero-signature {
  max-width: 46ch;
  margin-top: var(--space-3);
  color: var(--color-ink-2);
  font-size: var(--text-body);
  line-height: var(--leading-body);
  overflow-wrap: anywhere;
}

.hero-signature.is-empty {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

@media (max-width: 767px) {
  .profile-hero {
    gap: var(--space-4);
    min-height: 0;
    padding: var(--space-6) var(--space-5);
  }

  .hero-scenery {
    width: 72%;
    opacity: 0.32;
  }

  .hero-avatar {
    flex-basis: 56px;
    width: 56px;
    height: 56px;
  }

  .hero-name {
    font-size: 24px;
    line-height: 32px;
  }

  /* 移动端触控目标不小于 44px */
  .hero-edit {
    flex-basis: 44px;
    width: 44px;
    height: 44px;
  }

  .hero-signature {
    margin-top: var(--space-2);
  }
}
</style>
