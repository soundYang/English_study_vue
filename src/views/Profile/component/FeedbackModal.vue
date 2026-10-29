<script setup>
/**
 * 意见反馈弹窗
 *
 * 用途：个人中心「意见反馈」入口，提交一条带分类的反馈（后端 md/37 §5.1）
 * 用法：<FeedbackModal v-model:open="feedbackOpen" @submitted="handleFeedbackSubmitted" />
 *
 * props:
 *   open — 是否打开（v-model:open）
 * emits:
 *   update:open / submitted — 提交成功
 *
 * 行为：
 *   - content 去首尾空白后 10–2000 字；本地先校验，后端 FEEDBACK_TOO_SHORT/TOO_LONG 也挂同一字段
 *   - category 必填六选一，与后端 zod 枚举一一对应；contact 选填 ≤100 字
 *   - page 自动带当前路由，未登录也能提交（设备号由 request.js 注入）
 *   - 429 RATE_LIMITED 是「每设备每天 5 条」，不进分钟级冷却，只提示「明天再来」
 */
import { computed, reactive, ref, useId, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseButton from '../../../component/BaseButton.vue'
import BaseInput from '../../../component/BaseInput.vue'
import BaseModal from '../../../component/BaseModal.vue'
import DropdownSelect from '../../../component/DropdownSelect.vue'
import { submitFeedback } from '../../../api/feedback'
import { normalizeApiError } from '../../../errors'

const CONTENT_MIN = 10
const CONTENT_MAX = 2000
const CONTACT_MAX = 100

// value 必须与后端 zod 枚举一致；label 只是下拉里的叫法
const CATEGORIES = [
  { value: 'bug', label: '功能异常' },
  { value: 'feature', label: '功能建议' },
  { value: 'content', label: '内容问题' },
  { value: 'data', label: '数据问题' },
  { value: 'privacy', label: '隐私相关' },
  { value: 'other', label: '其它' },
]

const props = defineProps({
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['update:open', 'submitted'])

const route = useRoute()
const uid = useId()
const contentId = `feedback-content-${uid}`

const form = reactive({
  category: 'other',
  content: '',
  contact: '',
})

const fieldErrors = ref({})
const generalError = ref('')
const submitting = ref(false)

// 计数与后端同口径：读去空白后的长度，用户看到的就是真正会被校验的数字
const trimmedContent = computed(() => form.content.trim())
const contentLength = computed(() => trimmedContent.value.length)
// 页面路径截到 100 字，避免极端长 URL 被后端 400 挡下；
// 没有路由上下文时（单元测试直接挂载、未来在布局外复用）退回当前入口所在页面
const page = computed(() => String(route?.fullPath || '/profile').slice(0, CONTACT_MAX))

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
  { immediate: true },
)

function reset() {
  form.category = 'other'
  form.content = ''
  form.contact = ''
  fieldErrors.value = {}
  generalError.value = ''
}

function close() {
  if (submitting.value) return
  emit('update:open', false)
}

function validate() {
  const errors = {}

  if (contentLength.value < CONTENT_MIN) errors.content = `反馈内容至少 ${CONTENT_MIN} 个字`
  else if (contentLength.value > CONTENT_MAX) errors.content = `反馈内容最多 ${CONTENT_MAX} 个字`

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function handleSubmit() {
  if (submitting.value) return
  if (!validate()) return

  generalError.value = ''
  submitting.value = true

  try {
    await submitFeedback({
      category: form.category,
      content: trimmedContent.value,
      // 空联系方式不发：后端只要非空字符串，别塞一个空串占位
      ...(form.contact.trim() ? { contact: form.contact.trim() } : {}),
      page: page.value,
    })

    emit('submitted')
    emit('update:open', false)
  } catch (caught) {
    const normalized = normalizeApiError(caught)
    if (normalized?.field === 'content') {
      fieldErrors.value = { ...fieldErrors.value, content: normalized.message }
    } else if (normalized?.code === 'RATE_LIMITED') {
      // 与生成限流分开：这里是「每天 5 条」，没有倒计时，刷新也不会恢复
      generalError.value = '今天的反馈次数已用完，明天再来吧。'
    } else {
      generalError.value = normalized?.message || '提交失败，请稍后重试。'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    title="意见反馈"
    description="遇到问题或想加点什么？告诉我们，会认真看。"
    :max-width="480"
    :close-on-backdrop="!submitting"
    :close-on-esc="!submitting"
    :show-close="!submitting"
    @update:open="emit('update:open', $event)"
  >
    <form id="feedback-form" class="feedback-form" novalidate @submit.prevent="handleSubmit">
      <div class="field">
        <span class="field-label">反馈类型</span>
        <DropdownSelect v-model="form.category" :options="CATEGORIES" aria-label="反馈类型" />
      </div>

      <div class="field" :class="{ 'has-error': fieldErrors.content }">
        <label class="field-label" :for="contentId">反馈内容</label>
        <textarea
          :id="contentId"
          v-model="form.content"
          class="field-textarea"
          name="content"
          :maxlength="CONTENT_MAX"
          :aria-invalid="fieldErrors.content ? 'true' : undefined"
          :aria-describedby="fieldErrors.content ? `${contentId}-error` : `${contentId}-hint`"
          :placeholder="`请描述你遇到的问题或建议（${CONTENT_MIN}–${CONTENT_MAX} 字）`"
        />
        <div class="field-meta">
          <p v-if="fieldErrors.content" :id="`${contentId}-error`" class="field-error" role="alert">
            {{ fieldErrors.content }}
          </p>
          <p v-else :id="`${contentId}-hint`" class="field-hint">提交前会去掉首尾空白</p>
          <span class="field-count" aria-live="polite">{{ contentLength }}/{{ CONTENT_MAX }}</span>
        </div>
      </div>

      <BaseInput
        v-model="form.contact"
        label="联系方式（选填）"
        name="contact"
        placeholder="邮箱 / 微信，方便我们回复你"
        :maxlength="CONTACT_MAX"
      />

      <p class="field-hint">当前页面会自动附在反馈里：{{ page }}</p>
      <p v-if="generalError" class="form-error" role="alert">{{ generalError }}</p>
    </form>

    <template #footer>
      <BaseButton variant="secondary" :disabled="submitting" @click="close">取消</BaseButton>
      <BaseButton :loading="submitting" @click="handleSubmit">提交反馈</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.feedback-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.field-textarea {
  width: 100%;
  min-height: 128px;
  padding: var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: inherit;
  font-size: 14px;
  line-height: 22px;
  resize: vertical;
  transition:
    border-color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}

.field-textarea::placeholder {
  color: var(--color-muted);
}

.field-textarea:hover {
  border-color: var(--color-line-strong);
}

.field-textarea:focus {
  border-color: var(--color-primary);
}

.has-error .field-textarea {
  border-color: var(--color-danger);
}

.field-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.field-hint {
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.field-error {
  color: var(--color-danger);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

/* 计数器用等宽数字，输入时长度变化不会让整行左右跳 */
.field-count {
  flex: 0 0 auto;
  color: var(--color-muted);
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
  line-height: var(--leading-caption);
}

.form-error {
  color: var(--color-danger);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

@media (max-width: 767px) {
  .field-textarea {
    font-size: 16px;
  }
}
</style>
