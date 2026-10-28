<script setup>
/**
 * 编辑资料弹窗
 *
 * 用途：修改昵称与个性签名；成功后关闭并通知父级刷新资料
 * 用法：<ProfileEditModal v-model:open="editOpen" :user="user" @saved="handleProfileSaved" />
 *
 * props:
 *   open — 是否打开（v-model:open）
 *   user — 当前用户资料，打开时用于初始化表单
 * emits:
 *   update:open / saved — 保存成功，参数为后端返回的 user
 */
import { reactive, ref, watch } from 'vue'
import BaseButton from '../../../component/BaseButton.vue'
import BaseInput from '../../../component/BaseInput.vue'
import BaseModal from '../../../component/BaseModal.vue'
import { updateProfile } from '../../../api/profile'
import { normalizeApiError } from '../../../errors'

const NICKNAME_MAX = 20
const SIGNATURE_MAX = 60

const props = defineProps({
  open: { type: Boolean, default: false },
  user: { type: Object, default: null },
})

const emit = defineEmits(['update:open', 'saved'])

const form = reactive({
  nickname: '',
  signature: '',
})

const fieldErrors = ref({})
const generalError = ref('')
const submitting = ref(false)

function resetForm() {
  form.nickname = String(props.user?.nickname || props.user?.username || '')
  form.signature = String(props.user?.signature || '')
  fieldErrors.value = {}
  generalError.value = ''
}

watch(
  () => [props.open, props.user],
  ([open]) => {
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
  const nickname = form.nickname.trim()
  const signature = form.signature.trim()

  if (!nickname) errors.nickname = '昵称不能为空'
  else if (nickname.length > NICKNAME_MAX) errors.nickname = `昵称最多 ${NICKNAME_MAX} 个字符`

  if (signature.length > SIGNATURE_MAX) {
    errors.signature = `个性签名最多 ${SIGNATURE_MAX} 个字符`
  }

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function handleSubmit() {
  if (submitting.value) return
  if (!validate()) return

  generalError.value = ''
  submitting.value = true

  try {
    const data = await updateProfile({
      nickname: form.nickname.trim(),
      signature: form.signature.trim(),
    })

    emit('saved', data?.user || null)
    emit('update:open', false)
  } catch (caught) {
    const normalized = normalizeApiError(caught)
    // 后端把字段级错误挂在 field 上；其它错误统一放在表单底部
    if (normalized?.field === 'nickname' || normalized?.field === 'signature') {
      fieldErrors.value = { ...fieldErrors.value, [normalized.field]: normalized.message }
    } else {
      generalError.value = normalized?.message || '保存失败，请稍后重试。'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    title="编辑个人资料"
    description="昵称与个性签名会显示在个人中心。"
    :max-width="480"
    :close-on-backdrop="!submitting"
    :close-on-esc="!submitting"
    :show-close="!submitting"
    @update:open="emit('update:open', $event)"
  >
    <form id="profile-edit-form" class="edit-form" novalidate @submit.prevent="handleSubmit">
      <BaseInput
        v-model="form.nickname"
        label="昵称"
        placeholder="怎么称呼你"
        name="nickname"
        :maxlength="NICKNAME_MAX"
        :error="fieldErrors.nickname"
        :hint="`1–${NICKNAME_MAX} 个字符`"
        autocomplete="off"
      />

      <BaseInput
        v-model="form.signature"
        label="个性签名"
        placeholder="写一句给自己的话（选填）"
        name="signature"
        :maxlength="SIGNATURE_MAX"
        :error="fieldErrors.signature"
        :hint="`选填，最多 ${SIGNATURE_MAX} 个字符`"
        autocomplete="off"
      />

      <p v-if="generalError" class="form-error" role="alert">{{ generalError }}</p>
    </form>

    <template #footer>
      <BaseButton variant="secondary" :disabled="submitting" @click="close">取消</BaseButton>
      <BaseButton :loading="submitting" @click="handleSubmit">保存</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.edit-form {
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
