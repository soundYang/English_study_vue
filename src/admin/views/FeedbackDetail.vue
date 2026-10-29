<script setup>
/**
 * 反馈详情
 *
 * 用途：`/admin/feedback/:id`——全文、设备 / IP / UA、回复与关闭。
 *       状态只能推进到 `replied` / `closed`；已关闭的可以再回复（回到 replied）。
 * 用法：从反馈列表点击行进入。
 *
 * 隐私：列表里的手机号 / 联系方式由后端打码，详情是**唯一**返回完整值的入口
 *       （md/45 M6），所以这里原样展示、不再二次遮挡；需要联系用户就只看这一页。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import BaseButton from '../../component/BaseButton.vue'
import EmptyState from '../../component/EmptyState.vue'
import SkeletonBlock from '../../component/SkeletonBlock.vue'
import AdminStatePill from '../component/AdminStatePill.vue'
import { fetchAdminFeedbackDetail, updateAdminFeedback } from '../api/feedback'
import { contactLabel, feedbackCategoryLabel, formatDateTime, submitterLabel } from '../format'

const REPLY_MAX_LENGTH = 2000

const route = useRoute()
const router = useRouter()

const feedback = ref(null)
const loading = ref(true)
const busy = ref(false)
const errorMessage = ref('')
const errorCode = ref('')
const replyText = ref('')
const replyError = ref('')
const savedNotice = ref('')

let savedTimer = null

const id = computed(() => String(route.params.id || ''))
const replyLength = computed(() => replyText.value.trim().length)

const submitterText = computed(() => {
  const row = feedback.value
  if (!row) return '—'

  const name = submitterLabel(row)
  return row.username && row.username !== name ? `${name}（@${row.username}）` : name
})

const replyActionLabel = computed(() => {
  if (feedback.value?.status === 'closed') return '补充回复'
  if (feedback.value?.status === 'replied') return '更新回复'
  return '标记为已回复'
})

const deviceShort = computed(() => {
  const value = feedback.value?.deviceId || ''
  return value.length > 8 ? `${value.slice(0, 8)}…` : value
})

async function load() {
  loading.value = true
  errorMessage.value = ''
  errorCode.value = ''

  try {
    feedback.value = await fetchAdminFeedbackDetail(id.value)
  } catch (error) {
    errorCode.value = error?.code || ''
    errorMessage.value = error?.message || '加载失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}

function goBack() {
  if (window.history.state?.back) router.back()
  else router.replace({ name: 'admin-feedback' })
}

async function submit(payload) {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  replyError.value = ''
  savedNotice.value = ''

  try {
    feedback.value = await updateAdminFeedback(id.value, payload)
    replyText.value = ''
    savedNotice.value = '已保存'
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => {
      savedNotice.value = ''
    }, 2000)
  } catch (error) {
    if (error?.code === 'INVALID_REQUEST' && error.field === 'reply') {
      replyError.value = error.message || '回复内容不正确'
    } else {
      errorMessage.value = error?.message || '保存失败，请稍后重试。'
    }
  } finally {
    busy.value = false
  }
}

function markReplied() {
  const text = replyText.value.trim()
  if (!text) {
    replyError.value = '请填写回复内容'
    return
  }
  submit({ status: 'replied', reply: text })
}

function closeFeedback() {
  submit({ status: 'closed' })
}

onMounted(() => load())

onBeforeUnmount(() => {
  clearTimeout(savedTimer)
})
</script>

<template>
  <section class="feedback-detail">
    <div class="detail-head">
      <button type="button" class="back" @click="goBack">
        <ArrowLeft :size="16" :stroke-width="1.8" aria-hidden="true" />
        用户反馈
      </button>

      <AdminStatePill v-if="feedback" kind="feedback" :value="feedback.status" />
    </div>

    <div v-if="errorMessage && errorCode === 'FEEDBACK_NOT_FOUND'" class="block-state">
      <EmptyState title="这条反馈不存在" description="可能已被删除，或链接里的编号不正确。">
        <template #actions>
          <BaseButton variant="secondary" @click="goBack">返回列表</BaseButton>
        </template>
      </EmptyState>
    </div>

    <template v-else>
      <div v-if="errorMessage" class="error-strip" role="alert">
        <span>{{ errorMessage }}</span>
        <button type="button" class="error-action" @click="load">重试</button>
      </div>

      <div v-if="loading && !feedback" class="skeleton-card">
        <SkeletonBlock height="20px" width="50%" />
        <SkeletonBlock height="20px" width="70%" />
        <SkeletonBlock height="120px" width="100%" />
      </div>

      <template v-if="feedback">
        <article class="meta-card">
          <dl class="meta-grid">
            <div class="meta-item">
              <dt>提交人</dt>
              <dd>{{ submitterText }}</dd>
            </div>
            <div class="meta-item">
              <dt>账号手机</dt>
              <dd class="num">{{ feedback.phone || '—' }}</dd>
            </div>
            <div class="meta-item">
              <dt>联系方式</dt>
              <dd>{{ contactLabel(feedback) }}</dd>
            </div>
            <div class="meta-item">
              <dt>分类</dt>
              <dd>{{ feedbackCategoryLabel(feedback.category) }}</dd>
            </div>
            <div class="meta-item">
              <dt>页面</dt>
              <dd>{{ feedback.page || '—' }}</dd>
            </div>
            <div class="meta-item">
              <dt>设备</dt>
              <dd class="mono" :title="feedback.deviceId || ''">
                {{ deviceShort || '—' }}
              </dd>
            </div>
            <div class="meta-item">
              <dt>IP</dt>
              <dd class="mono">{{ feedback.ip || '—' }}</dd>
            </div>
            <div class="meta-item is-wide">
              <dt>User Agent</dt>
              <dd class="ua" :title="feedback.userAgent || ''">{{ feedback.userAgent || '—' }}</dd>
            </div>
            <div class="meta-item">
              <dt>提交</dt>
              <dd class="num">{{ formatDateTime(feedback.createdAt) }}</dd>
            </div>
            <div class="meta-item">
              <dt>更新</dt>
              <dd class="num">{{ formatDateTime(feedback.updatedAt) }}</dd>
            </div>
            <div class="meta-item">
              <dt>回复</dt>
              <dd class="num">
                {{ feedback.repliedAt ? formatDateTime(feedback.repliedAt) : '—' }}
              </dd>
            </div>
          </dl>
        </article>

        <article class="content-card">
          <p class="card-label">正文</p>
          <p class="content-text">{{ feedback.content }}</p>
        </article>

        <article v-if="feedback.reply" class="reply-card">
          <p class="card-label">管理员回复</p>
          <p class="content-text">{{ feedback.reply }}</p>
          <p class="reply-meta">
            {{ feedback.repliedBy || '管理员' }} · {{ formatDateTime(feedback.repliedAt) }}
          </p>
        </article>

        <article class="reply-form">
          <div class="form-head">
            <label class="card-label" for="feedback-reply">回复</label>
            <span class="counter num">{{ replyLength }} / {{ REPLY_MAX_LENGTH }}</span>
          </div>

          <textarea
            id="feedback-reply"
            v-model="replyText"
            class="reply-input"
            rows="6"
            :maxlength="REPLY_MAX_LENGTH"
            :disabled="busy"
            placeholder="写清楚处理结果，用户会在反馈里看到这条回复。"
          />

          <p v-if="replyError" class="field-error" role="alert">{{ replyError }}</p>
          <p v-else-if="!replyLength" class="field-hint">请填写回复内容后保存。</p>

          <div class="form-actions">
            <BaseButton :disabled="!replyLength || busy" :loading="busy" @click="markReplied">
              {{ replyActionLabel }}
            </BaseButton>
            <BaseButton variant="secondary" :disabled="busy" @click="closeFeedback">
              关闭反馈
            </BaseButton>
            <span v-if="savedNotice" class="saved" role="status">{{ savedNotice }}</span>
          </div>
        </article>
      </template>
    </template>
  </section>
</template>

<style scoped>
.feedback-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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

.meta-card,
.content-card,
.reply-card,
.reply-form {
  padding: var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-4) var(--space-6);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.meta-item.is-wide {
  grid-column: 1 / -1;
}

.meta-item dt {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.meta-item dd {
  overflow: hidden;
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--text-caption);
}

.card-label {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  letter-spacing: 0.08em;
}

.content-card,
.reply-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.content-text {
  color: var(--color-ink);
  font-size: var(--text-body);
  line-height: var(--leading-body);
  white-space: pre-wrap;
  word-break: break-word;
}

.reply-card {
  border-color: var(--color-success);
  background: var(--color-success-bg);
}

.reply-card .card-label,
.reply-card .content-text {
  color: var(--color-success);
}

.reply-meta {
  color: var(--color-success);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.reply-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.form-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.counter {
  color: var(--color-muted-2);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.reply-input {
  width: 100%;
  min-height: 132px;
  padding: var(--space-3);
  border: 1px solid var(--color-line-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: var(--font-body);
  font-size: var(--text-body);
  line-height: var(--leading-body);
  resize: vertical;
}

.reply-input:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.reply-input:disabled {
  background: var(--color-bg-deep);
  cursor: not-allowed;
}

.field-error {
  color: var(--color-danger);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.field-hint {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.saved {
  color: var(--color-success);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

@media (max-width: 767px) {
  .meta-card,
  .content-card,
  .reply-card,
  .reply-form {
    padding: var(--space-5);
  }
}
</style>
