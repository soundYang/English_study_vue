<script setup>
/**
 * 个人中心视图
 *
 * 用途：展示账户资料、学习统计与账户设置；资料与统计分别来自 /profile、/profile/stats
 *       与 /words/stats（后端 md/33 §6.2、§9.2；md/56 P3），一个失败就整页给出重试，
 *       避免只显示半张页面。
 * 用法：路由 /profile
 *
 * 行为：
 *   - 加载中显示与最终布局同尺寸的骨架，不先渲染假数字
 *   - 修改昵称 / 签名后原地更新头图；改密码成功后只提示，不改变当前会话
 *   - API 设置卡由自己读取自备 Key 状态；服务端未开启功能时整块隐藏，
 *     只剩账户设置卡时让它占满两列（md/43 §5.1）
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../../component/BaseButton.vue'
import GuestNotice from '../../component/GuestNotice.vue'
import SkeletonBlock from '../../component/SkeletonBlock.vue'
import AccountSettings from './component/AccountSettings.vue'
import ApiSettings from './component/ApiSettings.vue'
import FeedbackModal from './component/FeedbackModal.vue'
import PasswordModal from './component/PasswordModal.vue'
import ProfileEditModal from './component/ProfileEditModal.vue'
import ProfileHero from './component/ProfileHero.vue'
import ProfileStats from './component/ProfileStats.vue'
import StudyStats from './component/StudyStats.vue'
import { fetchProfile, fetchProfileStats } from '../../api/profile'
import { fetchStudyStats } from '../../api/words'
import { useAuthGate } from '../../composables/useAuthGate'
import { useToast } from '../../composables/useToast'
import { normalizeApiError } from '../../errors'
import { useAuthStore } from '../../stores/model/auth'

const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const { goLogin } = useAuthGate()
// 游客看到遮罩后的页面结构，资料与统计请求一律不发（md/45 §5.6）
const isGuest = computed(() => !auth.isAuthenticated)

const user = ref(null)
const stats = ref(null)
// 复习统计（md/56 P3）：与阅读统计一起拉，失败同样整页重试
const studyStats = ref(null)
const loading = ref(true)
const error = ref('')
const errorRequestId = ref('')

const editOpen = ref(false)
const passwordOpen = ref(false)
const feedbackOpen = ref(false)

onMounted(() => {
  // 游客不发私人请求：关掉骨架，交给 masked 分支渲染占位
  if (isGuest.value) {
    loading.value = false
    return
  }
  load()
})

// 登录态变化：掉线清掉私人资料并切回遮罩；登录成功重新拉取
watch(isGuest, (guest) => {
  user.value = null
  stats.value = null
  studyStats.value = null
  error.value = ''
  errorRequestId.value = ''

  if (guest) {
    loading.value = false
    return
  }

  load()
})

async function load() {
  if (isGuest.value) {
    loading.value = false
    return
  }

  loading.value = true
  error.value = ''
  errorRequestId.value = ''

  try {
    const [profileData, statsData, studyData] = await Promise.all([
      fetchProfile(),
      fetchProfileStats(),
      fetchStudyStats(),
    ])

    if (!profileData?.user) {
      error.value = '没有拿到账户资料，请稍后重试。'
      return
    }

    user.value = profileData.user
    stats.value = statsData || null
    studyStats.value = studyData || null
  } catch (caught) {
    const normalized = normalizeApiError(caught)
    error.value = normalized?.message || '个人中心加载失败，请稍后重试。'
    errorRequestId.value = normalized?.requestId || ''
  } finally {
    loading.value = false
  }
}

function handleProfileSaved(next) {
  if (next) {
    user.value = next
    // 顶栏读的是 auth store，资料改了要同步过去，否则顶栏还显示旧昵称
    auth.updateUser(next)
  }
  toast.success('个人资料已更新')
}

function handlePasswordChanged() {
  toast.success('密码已更新')
}

function handleFeedbackSubmitted() {
  toast.success('感谢反馈，我们已经收到')
}

async function handleLogout() {
  await auth.logout()
  toast.success('已退出登录')
  // 退出后回公开首页，而不是立刻又被登录页拦住（md/42）
  router.replace('/')
}
</script>

<template>
  <section class="profile-page">
    <h1 class="sr-only">个人中心</h1>
    <p v-if="loading" class="sr-only" role="status">正在加载个人中心</p>
    <p v-else-if="isGuest" class="sr-only">正在以游客身份浏览</p>

    <div v-if="error" class="state-card" role="alert">
      <p class="state-title">个人中心加载失败</p>
      <p class="state-desc">{{ error }}</p>
      <p v-if="errorRequestId" class="state-id">错误编号：{{ errorRequestId }}</p>
      <BaseButton variant="secondary" :loading="loading" @click="load">重试</BaseButton>
    </div>

    <template v-else-if="loading">
      <div class="skeleton-hero" aria-hidden="true">
        <SkeletonBlock width="72px" height="72px" circle />
        <div class="skeleton-lines">
          <SkeletonBlock width="160px" height="28px" />
          <SkeletonBlock width="96px" height="12px" />
          <SkeletonBlock width="240px" height="14px" />
        </div>
      </div>

      <div class="skeleton-stats" aria-hidden="true">
        <SkeletonBlock v-for="index in 3" :key="index" height="176px" radius="var(--radius-lg)" />
      </div>
    </template>

    <template v-else-if="isGuest">
      <ProfileHero masked />
      <ProfileStats masked />
      <StudyStats masked />

      <div class="settings-grid">
        <GuestNotice
          compact
          title="登录后管理账号、密码与 API Key"
          description="你的资料、统计与设置都会保存在账号里。"
          @login="goLogin('/profile')"
        />
      </div>
    </template>

    <template v-else-if="user">
      <ProfileHero :user="user" @edit="editOpen = true" />
      <ProfileStats :stats="stats" />
      <StudyStats :stats="studyStats" />

      <div class="settings-grid">
        <AccountSettings
          :nickname="user.nickname || user.username"
          @edit-nickname="editOpen = true"
          @change-password="passwordOpen = true"
          @feedback="feedbackOpen = true"
          @logout="handleLogout"
        />
        <ApiSettings />
      </div>
    </template>

    <ProfileEditModal v-model:open="editOpen" :user="user" @saved="handleProfileSaved" />
    <PasswordModal v-model:open="passwordOpen" @changed="handlePasswordChanged" />
    <FeedbackModal v-model:open="feedbackOpen" @submitted="handleFeedbackSubmitted" />
  </section>
</template>

<style scoped>
.profile-page {
  width: 100%;
}

.profile-page > .profile-hero,
.profile-page > .profile-stats,
.profile-page > .study-stats,
.profile-page > .settings-grid {
  animation: profile-rise var(--dur-page) var(--ease-out) both;
}

.profile-page > .profile-stats {
  animation-delay: 40ms;
}

.profile-page > .study-stats {
  animation-delay: 80ms;
}

.profile-page > .settings-grid {
  animation-delay: 120ms;
}

.settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 58fr) minmax(0, 42fr);
  align-items: stretch;
  gap: var(--space-5);
  margin-top: var(--space-5);
}

/* API 设置卡在服务端关闭功能时整块不渲染；只剩账户设置时占满整行，
   避免右半边留一块空白（注释节点不参与 :only-child 判断） */
.settings-grid > .settings-card:only-child {
  grid-column: 1 / -1;
}

/* 游客态只有一张提示卡，占满整行，避免右半边空着 */
.settings-grid > .guest-notice {
  grid-column: 1 / -1;
}

.skeleton-hero {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  min-height: 184px;
  padding: var(--space-8);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

.skeleton-lines {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.skeleton-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-5);
  margin-top: var(--space-5);
}

.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-10) var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  text-align: center;
}

.state-title {
  color: var(--color-ink-2);
  font-size: 16px;
  font-weight: 500;
  line-height: 26px;
}

.state-desc {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  overflow-wrap: anywhere;
}

.state-id {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

@keyframes profile-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@media (max-width: 1023px) {
  .settings-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .skeleton-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .skeleton-stats > :last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 767px) {
  .skeleton-hero {
    gap: var(--space-4);
    min-height: 0;
    padding: var(--space-6) var(--space-5);
  }

  .skeleton-stats {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }

  .skeleton-stats > :last-child {
    grid-column: auto;
  }

  .settings-grid {
    gap: var(--space-3);
  }
}
</style>
