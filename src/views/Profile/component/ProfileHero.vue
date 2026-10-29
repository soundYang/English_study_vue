<script setup>
/**
 * 个人中心头图
 *
 * 用途：展示头像、昵称、账号与个性签名，铅笔按钮打开资料编辑
 *       头像用昵称（缺省时用用户名）的首字母大写，与顶栏头像同一规则
 * 用法：<ProfileHero :user="user" @edit="editOpen = true" />
 *
 * props:
 *   user   — 当前用户资料（nickname / username / signature）；游客态不传
 *   masked — 游客态：头像显示「?」、昵称与签名遮罩，隐藏编辑按钮
 * emits:
 *   edit — 点击铅笔按钮
 */
import { computed } from 'vue'
import { Pencil } from 'lucide-vue-next'
import GuestMask from '../../../component/GuestMask.vue'
import mountains from '../../../assets/images/profile-mountains.png'

const props = defineProps({
  user: { type: Object, default: null },
  masked: { type: Boolean, default: false },
})

const emit = defineEmits(['edit'])

const displayName = computed(
  () => String(props.user?.nickname || '').trim() || String(props.user?.username || '').trim(),
)
const signature = computed(() => String(props.user?.signature || '').trim())
const username = computed(() => String(props.user?.username || '').trim())

// 与顶栏 .user-avatar 同规则：取展示名的第一个字符，英文转大写，中文原样
const avatarInitial = computed(() => {
  const name = displayName.value || username.value
  return name ? Array.from(name)[0].toUpperCase() : '?'
})
</script>

<template>
  <header class="profile-hero">
    <!-- 山景与飞鸟是装饰，不承载信息：头像与昵称各自可读，读屏跳过这一层 -->
    <div class="hero-scenery" aria-hidden="true">
      <img :src="mountains" alt="" />
    </div>

    <span class="hero-avatar" aria-hidden="true">
      <span v-if="masked" class="avatar-question">?</span>
      <span v-else class="avatar-initial">{{ avatarInitial }}</span>
    </span>

    <div class="hero-info">
      <div class="hero-name-row">
        <p class="hero-name">
          <GuestMask v-if="masked" width="6em" />
          <template v-else>{{ displayName || '未命名' }}</template>
        </p>
        <button
          v-if="!masked"
          class="hero-edit"
          type="button"
          aria-label="编辑个人资料"
          @click="emit('edit')"
        >
          <Pencil :size="15" :stroke-width="1.8" aria-hidden="true" />
        </button>
      </div>

      <p class="hero-id">ID: {{ masked ? '--' : username || '—' }}</p>

      <p v-if="masked" class="hero-signature">
        <GuestMask width="12em" />
      </p>
      <p v-else-if="signature" class="hero-signature">「{{ signature }}」</p>
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

.hero-scenery img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 85% 58%;
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
  background: var(--color-warning-bg);
  box-shadow: var(--shadow-md);
}

/* 首字母头像：暖沙底 + 墨色字，和头图的奶油色融在一起 */
.avatar-initial,
.avatar-question {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 600;
  line-height: 1;
}

/* 游客态不展示任何用户信息，只留一个问号示意 */
.avatar-question {
  color: var(--color-muted);
  font-weight: 400;
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

  .avatar-initial,
  .avatar-question {
    font-size: 24px;
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
