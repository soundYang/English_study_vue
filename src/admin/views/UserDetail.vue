<script setup>
/**
 * 用户详情
 *
 * 用途：`/admin/users/:dataKey`——全量手机号、三档已知词、token 七桶、
 *       今日额度、失败摘要与最近 20 篇文章。
 * 用法：从用户台账点击行进入；返回优先走浏览器历史，直接打开时回列表。
 *
 * 隐私：手机号只在本页展示与复制，不写进 URL、本地存储或日志（md/40 §9）。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Check, Copy, RefreshCw } from 'lucide-vue-next'
import BaseButton from '../../component/BaseButton.vue'
import EmptyState from '../../component/EmptyState.vue'
import SkeletonBlock from '../../component/SkeletonBlock.vue'
import StatusPill from '../../component/StatusPill.vue'
import AdminStatePill from '../component/AdminStatePill.vue'
import AdminTable from '../component/AdminTable.vue'
import { fetchAdminUser } from '../api/users'
import { formatCount, formatDateTime, formatQuota, formatTokens } from '../format'

const LEVEL_LABELS = [
  { key: 'easy', label: '简单' },
  { key: 'medium', label: '进阶' },
  { key: 'hard', label: '挑战' },
]

const RECENT_COLUMNS = [
  { key: 'createdAt', label: '时间' },
  { key: 'level', label: '难度' },
  { key: 'words', label: '目标 / 实际' },
  { key: 'status', label: '状态' },
  { key: 'accuracy', label: '正确率' },
  { key: 'score', label: '得分' },
  { key: 'tokens', label: 'token' },
]

const route = useRoute()
const router = useRouter()

const user = ref(null)
const loading = ref(true)
const refreshing = ref(false)
const errorMessage = ref('')
const errorCode = ref('')
const copiedKey = ref('')

let copyTimer = null

const dataKey = computed(() => String(route.params.dataKey || ''))
const availableWords = computed(() => user.value?.vocabulary?.knownWords || {})
const quota = computed(() => user.value?.quota || { enabled: false })
const failureSummary = computed(() => user.value?.failureSummary || { total: 0, topCodes: [] })
const recentReadings = computed(() => user.value?.recentReadings || [])

// token 七桶：总计是流水总和，不等于成功 + 失败；后四桶只在非零时展示，避免一排 0
const tokenBuckets = computed(() => {
  const tokens = user.value?.tokens || {}
  const extras = [
    { key: 'cancelled', label: '取消', value: tokens.cancelled },
    { key: 'running', label: '进行中', value: tokens.running },
    { key: 'sync', label: '同步', value: tokens.sync },
    { key: 'legacy', label: '历史', value: tokens.legacy },
  ].filter((item) => Number(item.value) > 0)

  return {
    total: tokens.total,
    success: tokens.success,
    failed: tokens.failed,
    extras,
  }
})

const quotaResetText = computed(() =>
  quota.value?.enabled && quota.value.resetAt ? `${formatDateTime(quota.value.resetAt)} 重置` : '',
)

function accuracyText(reading) {
  return reading.accuracy === null || reading.accuracy === undefined ? '—' : `${reading.accuracy}%`
}

async function load({ silent = false } = {}) {
  if (!dataKey.value) return
  if (silent) refreshing.value = true
  else loading.value = true
  errorMessage.value = ''
  errorCode.value = ''

  try {
    user.value = await fetchAdminUser(dataKey.value)
  } catch (error) {
    errorCode.value = error?.code || ''
    errorMessage.value = error?.message || '加载失败，请稍后重试。'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function goBack() {
  // 直接打开详情时没有可返回的历史，回列表；否则保留列表的筛选现场
  if (window.history.state?.back) router.back()
  else router.replace({ name: 'admin-users' })
}

async function copyText(value, key) {
  if (!value) return

  try {
    await navigator.clipboard.writeText(String(value))
    copiedKey.value = key
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copiedKey.value = ''
    }, 1500)
  } catch {
    copiedKey.value = ''
  }
}

onMounted(() => load())

onBeforeUnmount(() => {
  clearTimeout(copyTimer)
})
</script>

<template>
  <section class="user-detail">
    <button type="button" class="back" @click="goBack">
      <ArrowLeft :size="16" :stroke-width="1.8" aria-hidden="true" />
      用户台账
    </button>

    <div v-if="errorMessage && errorCode === 'ADMIN_USER_NOT_FOUND'" class="block-state">
      <EmptyState title="用户不存在" description="这个 dataKey 没有对应用户，可能已被删除。">
        <template #actions>
          <BaseButton variant="secondary" @click="goBack">返回列表</BaseButton>
        </template>
      </EmptyState>
    </div>

    <template v-else>
      <div v-if="errorMessage" class="error-strip" role="alert">
        <span>{{ errorMessage }}</span>
        <button type="button" class="error-action" @click="load()">重试</button>
      </div>

      <div v-if="loading && !user" class="skeleton-card">
        <SkeletonBlock height="28px" width="35%" />
        <SkeletonBlock height="18px" width="55%" />
        <SkeletonBlock height="18px" width="45%" />
      </div>

      <template v-if="user">
        <header class="profile-card">
          <div class="profile-head">
            <div class="profile-title">
              <h2 class="profile-name">{{ user.nickname }}</h2>
              <p class="profile-sub">
                @{{ user.username }} · {{ user.dataKey }}
                <button
                  type="button"
                  class="inline-action"
                  @click="copyText(user.dataKey, 'dataKey')"
                >
                  <Check v-if="copiedKey === 'dataKey'" :size="13" aria-hidden="true" />
                  <Copy v-else :size="13" aria-hidden="true" />
                  {{ copiedKey === 'dataKey' ? '已复制' : '复制 dataKey' }}
                </button>
              </p>
            </div>

            <BaseButton
              variant="secondary"
              size="sm"
              :loading="refreshing"
              @click="load({ silent: true })"
            >
              <RefreshCw v-if="!refreshing" :size="14" :stroke-width="1.8" aria-hidden="true" />
              刷新
            </BaseButton>
          </div>

          <dl class="profile-meta">
            <div class="meta-item">
              <dt>手机号</dt>
              <dd>
                <span v-if="user.phone" class="num">{{ user.phone }}</span>
                <span v-else class="is-muted">未填写</span>
                <button
                  v-if="user.phone"
                  type="button"
                  class="inline-action"
                  @click="copyText(user.phone, 'phone')"
                >
                  <Check v-if="copiedKey === 'phone'" :size="13" aria-hidden="true" />
                  <Copy v-else :size="13" aria-hidden="true" />
                  {{ copiedKey === 'phone' ? '已复制' : '复制' }}
                </button>
              </dd>
            </div>
            <div class="meta-item">
              <dt>注册</dt>
              <dd class="num">{{ formatDateTime(user.createdAt) }}</dd>
            </div>
            <div class="meta-item">
              <dt>最近登录</dt>
              <dd class="num">
                {{ user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '从未登录' }}
              </dd>
            </div>
          </dl>

          <p v-if="user.signature" class="signature">签名：{{ user.signature }}</p>
        </header>

        <div class="metric-grid">
          <article class="detail-card">
            <p class="card-label">词汇</p>
            <dl class="metric-list">
              <div class="metric-row">
                <dt>个人词库</dt>
                <dd class="num">{{ formatCount(user.vocabulary?.personalWords) }}</dd>
              </div>
              <div v-for="level in LEVEL_LABELS" :key="level.key" class="metric-row">
                <dt>已知 {{ level.label }}</dt>
                <dd class="num">{{ formatCount(availableWords[level.key]) }}</dd>
              </div>
            </dl>
          </article>

          <article class="detail-card">
            <p class="card-label">文章</p>
            <dl class="metric-list">
              <div class="metric-row">
                <dt>生成</dt>
                <dd class="num">{{ formatCount(user.readings?.generated) }}</dd>
              </div>
              <div class="metric-row">
                <dt>完成</dt>
                <dd class="num">{{ formatCount(user.readings?.completed) }}</dd>
              </div>
              <div class="metric-row">
                <dt>今日</dt>
                <dd class="num">{{ formatCount(user.readings?.today) }}</dd>
              </div>
              <div class="metric-row">
                <dt>失败</dt>
                <dd class="num" :class="{ 'is-warning': user.readings?.failed > 0 }">
                  {{ formatCount(user.readings?.failed) }}
                </dd>
              </div>
            </dl>
          </article>

          <article class="detail-card">
            <p class="card-label">题目</p>
            <dl class="metric-list">
              <div class="metric-row">
                <dt>作答</dt>
                <dd class="num">{{ formatCount(user.questions?.answered) }}</dd>
              </div>
              <div class="metric-row">
                <dt>正确</dt>
                <dd class="num">{{ formatCount(user.questions?.correct) }}</dd>
              </div>
              <div class="metric-row">
                <dt>正确率</dt>
                <dd class="num">
                  {{ user.questions?.answered ? `${user.questions.accuracy}%` : '—' }}
                </dd>
              </div>
            </dl>
          </article>

          <article class="detail-card">
            <p class="card-label">token</p>
            <dl class="metric-list">
              <div class="metric-row">
                <dt>总计</dt>
                <dd class="num" :title="formatCount(tokenBuckets.total)">
                  {{ formatTokens(tokenBuckets.total) }}
                </dd>
              </div>
              <div class="metric-row">
                <dt>成功</dt>
                <dd class="num" :title="formatCount(tokenBuckets.success)">
                  {{ formatTokens(tokenBuckets.success) }}
                </dd>
              </div>
              <div class="metric-row">
                <dt>失败</dt>
                <dd class="num" :title="formatCount(tokenBuckets.failed)">
                  {{ formatTokens(tokenBuckets.failed) }}
                </dd>
              </div>
              <div v-for="bucket in tokenBuckets.extras" :key="bucket.key" class="metric-row">
                <dt>{{ bucket.label }}</dt>
                <dd class="num" :title="formatCount(bucket.value)">
                  {{ formatTokens(bucket.value) }}
                </dd>
              </div>
            </dl>
          </article>
        </div>

        <div class="side-grid">
          <article class="detail-card">
            <p class="card-label">今日额度</p>
            <p class="quota-value num">{{ formatQuota(quota) }}</p>
            <p v-if="quota.enabled" class="card-hint">
              剩余 {{ formatCount(quota.remaining) }} · {{ quotaResetText }}
            </p>
            <p v-else class="card-hint">每日额度未启用，用户生成不受次数限制。</p>
          </article>

          <article class="detail-card">
            <p class="card-label">失败摘要</p>
            <template v-if="failureSummary.total > 0">
              <p class="card-hint">共 {{ formatCount(failureSummary.total) }} 次</p>
              <ul class="code-tags">
                <li v-for="item in failureSummary.topCodes" :key="item.code" class="code-tag">
                  {{ item.code }} × {{ formatCount(item.count) }}
                </li>
              </ul>
            </template>
            <p v-else class="card-hint">暂无失败记录</p>
          </article>
        </div>

        <section class="recent">
          <h3 class="section-title">最近文章（{{ recentReadings.length }}）</h3>

          <AdminTable
            :columns="RECENT_COLUMNS"
            :rows="recentReadings"
            min-width="880px"
            :skeleton-rows="5"
          >
            <template #cell-createdAt="{ row }">
              <span class="num">{{ formatDateTime(row.createdAt) }}</span>
            </template>

            <template #cell-level="{ row }">
              <StatusPill kind="level" :value="row.level" />
            </template>

            <template #cell-words="{ row }">
              <span class="num"
                >{{ formatCount(row.targetWords) }} / {{ formatCount(row.actualWords) }}</span
              >
            </template>

            <template #cell-status="{ row }">
              <AdminStatePill kind="reading" :value="row.status" />
            </template>

            <template #cell-accuracy="{ row }">
              <span class="num">{{ accuracyText(row) }}</span>
            </template>

            <template #cell-score="{ row }">
              <span class="num">{{ row.score === null ? '—' : row.score }}</span>
            </template>

            <template #cell-tokens="{ row }">
              <span class="num" :title="formatCount(row.tokens)">{{
                formatTokens(row.tokens)
              }}</span>
            </template>

            <template #empty>
              <EmptyState title="还没有文章" description="这个用户尚未生成过阅读。" compact />
            </template>
          </AdminTable>
        </section>
      </template>
    </template>
  </section>
</template>

<style scoped>
.user-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  cursor: pointer;
}

.back:hover {
  color: var(--color-ink);
}

.back:focus-visible {
  outline: none;
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.error-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 10px var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.error-action {
  flex: 0 0 auto;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-danger);
  font-size: var(--text-small);
  text-decoration: underline;
  cursor: pointer;
}

.error-action:focus-visible {
  outline: none;
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.block-state {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.profile-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.profile-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.profile-name {
  font-family: var(--font-display);
  font-size: 26px;
  line-height: 36px;
}

.profile-sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.inline-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-accent);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  cursor: pointer;
}

.inline-action:hover {
  text-decoration: underline;
}

.inline-action:focus-visible {
  outline: none;
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.profile-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-item dt {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.meta-item dd {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-ink);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.signature {
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  white-space: pre-wrap;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.side-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-4);
}

.detail-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.card-label {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  letter-spacing: 0.08em;
}

.metric-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metric-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.metric-row dt {
  color: var(--color-ink-2);
}

.metric-row dd {
  color: var(--color-ink);
  font-variant-numeric: tabular-nums;
}

.quota-value {
  font-family: var(--font-display);
  font-size: 28px;
  line-height: 36px;
  color: var(--color-ink);
}

.card-hint {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.code-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.code-tag {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-deep);
  color: var(--color-ink-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.section-title {
  margin-bottom: var(--space-3);
  font-family: var(--font-display);
  font-size: var(--text-section);
  line-height: var(--leading-section);
}

.recent {
  display: flex;
  flex-direction: column;
}

.is-muted {
  color: var(--color-muted-2);
}

.is-warning {
  color: var(--color-warning);
}

@media (max-width: 767px) {
  .profile-name {
    font-size: 22px;
    line-height: 30px;
  }

  .profile-meta {
    gap: var(--space-4);
  }
}
</style>
