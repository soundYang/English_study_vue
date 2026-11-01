<script setup>
/**
 * 编辑单词弹窗
 *
 * 用途：预填单词、释义与学习状态；单词重复时在字段下方提示，保存成功后关闭并通知父级高亮。
 *       命中词库的条目音标/词性/释义只读；改动单词会丢弃词库快照并降级为手填，保存前给出提示。
 * 用法：<WordEditModal v-model:open="editOpen" :word="editingWord" :save-word="handleUpdate" />
 *
 * props:
 *   open     — 是否打开（v-model:open）
 *   word     — 待编辑词汇对象；打开时用于初始化表单
 *   saveWord — 必填，接收 (id, patch)，返回 { ok, item?, errors?, message? }
 * emits:
 *   update:open / saved — 保存成功，参数为更新后的词汇
 */
import { computed, reactive, ref, watch } from 'vue'
import BaseButton from '../../../component/BaseButton.vue'
import BaseInput from '../../../component/BaseInput.vue'
import BaseModal from '../../../component/BaseModal.vue'
import SegmentedControl from '../../../component/SegmentedControl.vue'
import { isValidWordStatus, normalizeWord, validateWordInput } from '../../../unit/validators'

// 这里写的是 `status`（接口参数），不是展示用的 studyState（md/22 第 96 行）：
// 设 learning 会当天进复习队列、设 mastered 退出队列、设 new 退出队列等次日结算，
// 所以「新词」后面补一句去向，免得用户选完发现徽章写着「复习中」
const STATUS_OPTIONS = [
  { value: 'new', label: '新词（明天开始复习）' },
  { value: 'learning', label: '复习中' },
  { value: 'mastered', label: '已掌握' },
]

const props = defineProps({
  open: { type: Boolean, default: false },
  word: { type: Object, default: null },
  saveWord: { type: Function, required: true },
})

const emit = defineEmits(['update:open', 'saved'])

const form = reactive({
  word: '',
  meaning: '',
  status: 'learning',
})

const fieldErrors = ref({})
const generalError = ref('')
const submitting = ref(false)

// 词条信息只在命中词库的条目上存在，手填条目仍然编辑释义
const isDictionary = computed(() => props.word?.source === 'dictionary')
const phonetic = computed(() => props.word?.phonetic || null)
const senses = computed(() => props.word?.senses || [])
const wordChanged = computed(() => normalizeWord(form.word) !== (props.word?.word || ''))
const willDowngrade = computed(() => isDictionary.value && wordChanged.value)

function resetForm() {
  form.word = props.word?.word || ''
  form.meaning = props.word?.senses?.[0]?.meaning || ''
  form.status = props.word?.status || 'learning'
  fieldErrors.value = {}
  generalError.value = ''
}

watch(
  () => [props.open, props.word],
  ([open]) => {
    if (open) resetForm()
  },
  { immediate: true },
)

function close() {
  if (submitting.value) return
  emit('update:open', false)
}

async function handleSubmit() {
  if (submitting.value || !props.word) return

  const { valid, errors, word, meaning } = validateWordInput(form)
  fieldErrors.value = errors

  if (!isValidWordStatus(form.status)) {
    fieldErrors.value = { ...errors, status: '请选择学习状态' }
    return
  }
  if (!valid) return

  generalError.value = ''
  submitting.value = true

  try {
    // 词库条目不传释义：接口会拒绝；改词由后端统一降级为手填
    const patch = isDictionary.value
      ? { word, status: form.status }
      : { word, meaning, status: form.status }

    const result = await props.saveWord(props.word.id, patch)

    if (result?.ok) {
      emit('saved', result.item)
      emit('update:open', false)
      return
    }

    fieldErrors.value = result?.errors || {}
  } catch (caught) {
    generalError.value = caught?.message || '保存失败，请稍后重试。'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    title="编辑单词"
    description="修改后只影响词汇库，历史阅读中的词汇快照保持不变。"
    :max-width="480"
    :close-on-backdrop="!submitting"
    :close-on-esc="!submitting"
    :show-close="!submitting"
    @update:open="emit('update:open', $event)"
  >
    <form id="word-edit-form" class="edit-form" novalidate @submit.prevent="handleSubmit">
      <BaseInput
        v-model="form.word"
        label="英文单词"
        placeholder="请输入英文单词"
        name="word"
        maxlength="45"
        :error="fieldErrors.word"
      />

      <!-- 命中词库的条目：音标、词性、释义只读 -->
      <div
        v-if="isDictionary"
        class="entry-card"
        :class="{ 'is-outdated': willDowngrade }"
        aria-label="来自词库的词条，只读"
      >
        <div class="entry-phonetic" lang="en">
          <span>英 {{ phonetic?.uk || '—' }}</span>
          <span v-if="phonetic?.us && phonetic.us !== phonetic.uk">美 {{ phonetic.us }}</span>
        </div>
        <ul class="entry-senses">
          <li v-for="(sense, index) in senses" :key="index" class="entry-sense">
            <span v-if="sense.pos" class="entry-pos">{{ sense.pos }}</span>
            <span class="entry-meaning">{{ sense.meaning }}</span>
          </li>
        </ul>
      </div>

      <BaseInput
        v-else
        v-model="form.meaning"
        label="中文释义"
        placeholder="中文释义（可选）"
        name="meaning"
        maxlength="100"
        :error="fieldErrors.meaning"
      />

      <p v-if="willDowngrade" class="downgrade-note" role="alert">
        修改单词会清除该词的音标与释义，转为手动录入。
      </p>

      <div class="status-field">
        <span class="status-label">学习状态</span>
        <SegmentedControl
          v-model="form.status"
          :options="STATUS_OPTIONS"
          aria-label="学习状态"
          :disabled="submitting"
        />
        <p v-if="fieldErrors.status" class="status-error" role="alert">{{ fieldErrors.status }}</p>
      </div>

      <p v-if="generalError" class="form-error" role="alert">{{ generalError }}</p>
    </form>

    <template #footer>
      <BaseButton variant="secondary" :disabled="submitting" @click="close">取消</BaseButton>
      <BaseButton :loading="submitting" @click="handleSubmit">
        {{ willDowngrade ? '确认修改' : '保存' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.entry-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-bg-deep);
}

/* 单词已改动时这块快照即将作废，压暗以免被当成新词条的信息 */
.entry-card.is-outdated {
  opacity: 0.5;
}

.entry-phonetic {
  display: flex;
  gap: var(--space-3);
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.entry-senses {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.entry-sense {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.entry-pos {
  flex: none;
  color: var(--color-accent);
  font-size: var(--text-caption);
}

.entry-meaning {
  color: var(--color-ink-2);
}

.downgrade-note {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-warning-bg);
  color: var(--color-warning);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.status-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-label {
  color: var(--color-ink-2);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.status-field :deep(.segmented) {
  display: grid;
  width: 100%;
}

.status-field :deep(.segmented-item) {
  padding: 0 var(--space-2);
}

.status-error,
.form-error {
  color: var(--color-danger);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}
</style>
