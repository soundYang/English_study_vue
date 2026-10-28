<script setup>
/**
 * 修改密码弹窗
 *
 * 用途：校验旧密码与新密码强度，成功后关闭并通知父级提示
 * 用法：<PasswordModal v-model:open="passwordOpen" @changed="handlePasswordChanged" />
 *
 * props:
 *   open — 是否打开（v-model:open）
 * emits:
 *   update:open / changed — 修改成功
 */
import { reactive, ref, watch } from 'vue'
import BaseButton from '../../../component/BaseButton.vue'
import BaseInput from '../../../component/BaseInput.vue'
import BaseModal from '../../../component/BaseModal.vue'
import { changePassword } from '../../../api/profile'
import { normalizeApiError } from '../../../errors'

const PASSWORD_MIN = 8
const PASSWORD_MAX = 64

const props = defineProps({
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['update:open', 'changed'])

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const fieldErrors = ref({})
const generalError = ref('')
const submitting = ref(false)

function resetForm() {
  form.oldPassword = ''
  form.newPassword = ''
  form.confirmPassword = ''
  fieldErrors.value = {}
  generalError.value = ''
}

watch(
  () => props.open,
  (open) => {
    if (open) resetForm()
  },
  { immediate: true },
)

function close() {
  if (submitting.value) return
  emit('update:open', false)
}

function validate() {
  const errors = {}
  const next = form.newPassword

  if (!form.oldPassword) errors.oldPassword = '请输入当前密码'
  if (!next) errors.newPassword = '请输入新密码'
  else if (next.length < PASSWORD_MIN) errors.newPassword = `新密码至少 ${PASSWORD_MIN} 位`
  else if (next.length > PASSWORD_MAX) errors.newPassword = `新密码最多 ${PASSWORD_MAX} 位`
  else if (next === form.oldPassword) errors.newPassword = '新密码不能与当前密码相同'

  if (!form.confirmPassword) errors.confirmPassword = '请再次输入新密码'
  else if (form.confirmPassword !== next) errors.confirmPassword = '两次输入的新密码不一致'

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function handleSubmit() {
  if (submitting.value) return
  if (!validate()) return

  generalError.value = ''
  submitting.value = true

  try {
    await changePassword({
      oldPassword: form.oldPassword,
      newPassword: form.newPassword,
    })

    emit('changed')
    emit('update:open', false)
  } catch (caught) {
    const normalized = normalizeApiError(caught)
    if (normalized?.field === 'oldPassword' || normalized?.field === 'newPassword') {
      fieldErrors.value = { ...fieldErrors.value, [normalized.field]: normalized.message }
    } else {
      generalError.value = normalized?.message || '修改失败，请稍后重试。'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    title="修改密码"
    description="修改成功后，其它设备上的登录会失效，当前设备保持登录。"
    :max-width="440"
    :close-on-backdrop="!submitting"
    :close-on-esc="!submitting"
    :show-close="!submitting"
    @update:open="emit('update:open', $event)"
  >
    <form id="password-form" class="password-form" novalidate @submit.prevent="handleSubmit">
      <BaseInput
        v-model="form.oldPassword"
        label="当前密码"
        type="password"
        name="old-password"
        autocomplete="current-password"
        :error="fieldErrors.oldPassword"
      />

      <BaseInput
        v-model="form.newPassword"
        label="新密码"
        type="password"
        name="new-password"
        autocomplete="new-password"
        :maxlength="PASSWORD_MAX"
        :error="fieldErrors.newPassword"
        :hint="`至少 ${PASSWORD_MIN} 位，建议混合字母与数字`"
      />

      <BaseInput
        v-model="form.confirmPassword"
        label="确认新密码"
        type="password"
        name="confirm-password"
        autocomplete="new-password"
        :maxlength="PASSWORD_MAX"
        :error="fieldErrors.confirmPassword"
      />

      <p v-if="generalError" class="form-error" role="alert">{{ generalError }}</p>
    </form>

    <template #footer>
      <BaseButton variant="secondary" :disabled="submitting" @click="close">取消</BaseButton>
      <BaseButton :loading="submitting" @click="handleSubmit">确认修改</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.password-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-error {
  color: var(--color-danger);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}
</style>
