<script setup>
/**
 * API 设置卡
 *
 * 用途：个人中心右栏，管理用户自备的 DeepSeek API Key（后端 md/43）。
 *       未导入时给输入框与「导入」；已导入时只显示后端返回的掩码（形如 sk-****9f3a），
 *       提供「替换 / 重新校验 / 删除」。任何状态都不回显完整 Key。
 * 用法：<ApiSettings />
 *
 * 状态：
 *   loading      正在读 GET /api/profile/api-key
 *   enabled=false 服务端没开功能：整块隐藏，不报错（md/43 §5.1）
 *   key=null     没导入过：输入框 + 「导入」
 *   key≠null     已导入：掩码、状态（active / invalid / unreadable）、更新时间与三个动作
 *   写操作 503   USER_API_KEY_DISABLED：整块保留但置灰说明「暂未开放」
 *
 * 错误按 code 分支（md/43 §9）：
 *   400 INVALID_REQUEST / USER_API_KEY_INVALID → 挂输入框，保留已填内容
 *   502 USER_API_KEY_VERIFY_FAILED → 「暂时无法验证，请稍后再试」
 *   409 USER_API_KEY_MISSING（重新校验）→ 刷新状态，提示重新导入
 *   429 → 「操作太频繁」
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { KeyRound, PencilLine, RotateCcw, Trash2 } from 'lucide-vue-next'
import BaseButton from '../../../component/BaseButton.vue'
import BaseInput from '../../../component/BaseInput.vue'
import { deleteApiKey, fetchApiKey, saveApiKey, verifyApiKey } from '../../../api/profile'
import { useToast } from '../../../composables/useToast'
import { normalizeApiError } from '../../../errors'
import { formatDateTime } from '../../../unit/format'

const STATUS_META = {
  active: { label: '正常', tone: 'ok', note: '' },
  invalid: {
    label: '已失效',
    tone: 'warn',
    note: '这把 Key 已被 DeepSeek 拒绝，请重新导入。',
  },
  unreadable: {
    label: '需重新导入',
    tone: 'warn',
    note: '服务器密钥已变更，这把 Key 现在无法解密，请重新导入。',
  },
}

const toast = useToast()
const inputRef = ref(null)

const loading = ref(true)
const enabled = ref(false)
const key = ref(null)
const loadError = ref('')
// 写操作碰到 503：服务端在本次会话中途关了功能，保留卡片但不再给操作
const disabledNotice = ref(false)

const draft = ref('')
const editing = ref(false)
const saving = ref(false)
const verifying = ref(false)
const deleting = ref(false)
const confirmDelete = ref(false)
const formError = ref('')
const actionError = ref('')

const hasKey = computed(() => Boolean(key.value))
const statusMeta = computed(() => STATUS_META[key.value?.status] || null)
// 服务端明确关掉功能时整块隐藏；加载中、读取失败与 503 都还要给用户交代
const visible = computed(
  () => loading.value || Boolean(loadError.value) || disabledNotice.value || enabled.value,
)
const showForm = computed(() => !hasKey.value || editing.value)

const cardBadge = computed(() => {
  if (loading.value) return '读取中'
  if (loadError.value) return '读取失败'
  if (disabledNotice.value) return '暂未开放'
  if (!hasKey.value) return '未导入'

  return statusMeta.value?.label || '已接入'
})

// 后端只给时间戳，展示交给本地时区；没有的字段直接跳过，不留空占位
const metaLine = computed(() => {
  const parts = []
  if (key.value?.updatedAt) parts.push(`更新于 ${formatDateTime(key.value.updatedAt)}`)
  if (key.value?.lastVerifiedAt) parts.push(`最近校验 ${formatDateTime(key.value.lastVerifiedAt)}`)
  if (key.value?.lastUsedAt) parts.push(`最近使用 ${formatDateTime(key.value.lastUsedAt)}`)

  return parts.join(' · ')
})

onMounted(load)

async function load() {
  loading.value = true
  loadError.value = ''

  try {
    const data = await fetchApiKey()
    enabled.value = data?.enabled === true
    key.value = data?.key || null
    disabledNotice.value = false
  } catch (caught) {
    const normalized = normalizeApiError(caught)
    if (normalized?.code === 'USER_API_KEY_DISABLED') {
      enabled.value = false
      key.value = null
      disabledNotice.value = true
    } else {
      loadError.value = normalized?.message || '暂时读不到 API Key 状态，请稍后重试。'
    }
  } finally {
    loading.value = false
  }
}

function applyState(data) {
  enabled.value = data?.enabled === true
  key.value = data?.key || null
}

/** 把请求错误落到输入框或卡片底部；503 只改卡片状态 */
function showWriteError(caught, { form = false } = {}) {
  const normalized = normalizeApiError(caught)
  const code = normalized?.code || ''

  if (code === 'USER_API_KEY_DISABLED') {
    disabledNotice.value = true
    enabled.value = false
    return
  }

  let message = normalized?.message || '操作没有成功，请稍后重试。'
  if (code === 'USER_API_KEY_VERIFY_FAILED') message = '暂时无法验证这把 API Key，请稍后再试。'
  if (code === 'RATE_LIMITED') message = '操作太频繁，请稍后再试。'

  if (form) formError.value = message
  else actionError.value = message
}

async function startEdit() {
  editing.value = true
  draft.value = ''
  formError.value = ''
  actionError.value = ''
  confirmDelete.value = false

  await nextTick()
  inputRef.value?.focus()
}

function cancelEdit() {
  editing.value = false
  draft.value = ''
  formError.value = ''
}

async function handleSave() {
  if (saving.value) return

  const apiKey = draft.value.trim()
  if (!apiKey) {
    formError.value = '请输入 API Key'
    return
  }

  const replacing = hasKey.value
  formError.value = ''
  actionError.value = ''
  saving.value = true

  try {
    const data = await saveApiKey({ provider: 'deepseek', apiKey })
    applyState(data)
    draft.value = ''
    editing.value = false
    confirmDelete.value = false
    toast.success(replacing ? 'API Key 已更新' : 'API Key 已导入')
  } catch (caught) {
    // 失败保留已填内容，用户改一两个字符就能重试
    showWriteError(caught, { form: true })
  } finally {
    saving.value = false
  }
}

async function handleVerify() {
  if (verifying.value || !hasKey.value) return

  actionError.value = ''
  verifying.value = true

  try {
    const data = await verifyApiKey()
    applyState(data)
    toast.success('API Key 有效')
  } catch (caught) {
    const normalized = normalizeApiError(caught)

    // 上游拒绝时后端会把状态置为 invalid；这里同步一次，不必等下次刷新
    if (normalized?.code === 'USER_API_KEY_INVALID') {
      if (key.value) key.value = { ...key.value, status: 'invalid' }
      actionError.value = normalized.message || '这把 API Key 无效或已过期，请检查后重新导入'
    } else if (normalized?.code === 'USER_API_KEY_MISSING') {
      // 别的设备删掉了：刷新成未导入，并说明原因
      await load()
      actionError.value = '这把 Key 已经不在了，请重新导入。'
    } else {
      showWriteError(caught)
    }
  } finally {
    verifying.value = false
  }
}

async function handleDelete() {
  if (deleting.value) return

  actionError.value = ''
  deleting.value = true

  try {
    await deleteApiKey()
    key.value = null
    editing.value = false
    draft.value = ''
    confirmDelete.value = false
    toast.success('API Key 已删除')
  } catch (caught) {
    confirmDelete.value = false
    showWriteError(caught)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section
    v-if="visible"
    id="api-settings"
    class="settings-card api-settings"
    aria-labelledby="api-settings-title"
  >
    <header class="card-head">
      <span class="card-icon" aria-hidden="true">
        <KeyRound :size="18" :stroke-width="1.8" />
      </span>
      <h2 id="api-settings-title" class="card-title">API 设置</h2>
      <span class="card-badge" :class="{ 'is-warn': statusMeta?.tone === 'warn' }">
        {{ cardBadge }}
      </span>
    </header>

    <p v-if="loading" class="api-loading" role="status">正在读取 API Key 状态…</p>

    <div v-else-if="loadError" class="api-notice" role="alert">
      <p class="api-notice-text">{{ loadError }}</p>
      <BaseButton size="sm" variant="secondary" @click="load">重试</BaseButton>
    </div>

    <div v-else-if="disabledNotice" class="api-notice">
      <p class="api-notice-text">自备 API Key 功能暂未开启，生成会使用平台的免费额度。</p>
      <BaseButton size="sm" variant="secondary" @click="load">重试</BaseButton>
    </div>

    <form v-else-if="showForm" class="api-form" @submit.prevent="handleSave">
      <BaseInput
        ref="inputRef"
        v-model="draft"
        label="DeepSeek API Key"
        name="apiKey"
        type="password"
        placeholder="sk-..."
        autocomplete="off"
        spellcheck="false"
        maxlength="128"
        :error="formError"
        hint="导入前会先向 DeepSeek 校验一次；校验通过后加密保存。"
      />

      <p class="api-privacy">
        Key 只用于你的账号生成文章，页面只显示掩码（如 sk-****9f3a），不会回显完整内容。
      </p>

      <p class="api-help">
        还没有 Key？
        <a
          class="api-help-link"
          href="https://platform.deepseek.com/api_keys"
          target="_blank"
          rel="noopener noreferrer"
        >
          去 DeepSeek 开放平台创建
        </a>
      </p>

      <p class="api-help-note">
        登录后点「创建 API Key」，复制以 sk- 开头的字符串粘贴到这里。Key 只显示一次； API
        调用按量计费，账户需有余额。
      </p>

      <p v-if="actionError" class="api-notice-text is-error" role="alert">{{ actionError }}</p>

      <div class="api-actions">
        <BaseButton v-if="editing" variant="ghost" :disabled="saving" @click="cancelEdit">
          取消
        </BaseButton>
        <BaseButton type="submit" size="sm" :loading="saving" :disabled="!draft.trim()">
          {{ editing ? '保存' : '导入' }}
        </BaseButton>
      </div>
    </form>

    <template v-else>
      <div class="api-key-row">
        <span class="api-key-mask">{{ key.maskedKey }}</span>
        <span class="api-status" :class="statusMeta?.tone === 'warn' ? 'is-warn' : 'is-ok'">
          {{ statusMeta?.label || '已接入' }}
        </span>
      </div>

      <p v-if="statusMeta?.note" class="api-status-note">{{ statusMeta.note }}</p>
      <p v-if="metaLine" class="api-meta">{{ metaLine }}</p>

      <p v-if="actionError" class="api-notice-text is-error" role="alert">{{ actionError }}</p>

      <div v-if="confirmDelete" class="api-confirm">
        <p class="api-confirm-text">删除后生成会回到免费额度，确定删除这把 Key 吗？</p>
        <div class="api-actions">
          <BaseButton size="sm" variant="ghost" :disabled="deleting" @click="confirmDelete = false">
            取消
          </BaseButton>
          <BaseButton size="sm" variant="danger" :loading="deleting" @click="handleDelete">
            确认删除
          </BaseButton>
        </div>
      </div>

      <div v-else class="api-actions">
        <BaseButton size="sm" variant="secondary" @click="startEdit">
          <PencilLine :size="14" :stroke-width="1.8" aria-hidden="true" />
          替换
        </BaseButton>
        <BaseButton size="sm" variant="secondary" :loading="verifying" @click="handleVerify">
          <RotateCcw :size="14" :stroke-width="1.8" aria-hidden="true" />
          重新校验
        </BaseButton>
        <BaseButton size="sm" variant="ghost" @click="confirmDelete = true">
          <Trash2 :size="14" :stroke-width="1.8" aria-hidden="true" />
          删除
        </BaseButton>
      </div>
    </template>
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

.card-badge.is-warn {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.api-loading {
  padding: var(--space-4) 0 var(--space-5);
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.api-notice {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0 var(--space-4);
  border-top: 1px solid var(--color-line);
}

.api-notice-text {
  flex: 1;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  overflow-wrap: anywhere;
}

.api-notice-text.is-error {
  padding: var(--space-2) 0;
  color: var(--color-danger);
}

.api-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-line);
}

.api-privacy {
  margin-top: var(--space-1);
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.api-help {
  margin-top: var(--space-2);
  color: var(--color-ink-2);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.api-help-link {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.api-help-note {
  margin-top: 2px;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.api-key-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) 0 var(--space-2);
  border-top: 1px solid var(--color-line);
}

.api-key-mask {
  color: var(--color-ink);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: var(--text-body);
  letter-spacing: 0.02em;
}

.api-status {
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.api-status.is-ok {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.api-status.is-warn {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.api-status-note {
  color: var(--color-warning);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

.api-meta {
  margin-top: 2px;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
  overflow-wrap: anywhere;
}

.api-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: flex-end;
  padding: var(--space-3) 0 var(--space-2);
}

.api-confirm {
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-line);
}

.api-confirm-text {
  color: var(--color-ink-2);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

@media (max-width: 767px) {
  .settings-card {
    padding: var(--space-4) var(--space-5) var(--space-2);
  }

  .api-actions {
    justify-content: stretch;
  }

  .api-actions :deep(.base-button) {
    flex: 1 1 auto;
  }
}
</style>
