<script setup>
/**
 * 图形验证码
 *
 * 用途：验证码输入框 + 图片按钮，点图片或「换一张」都能换图。
 *       后端返回的是 SVG 字符串，这里转成 data URL 放进 <img>，不碰 v-html。
 * 用法：<CaptchaField v-model="captchaCode" :svg="captcha.svg" :error="errors.captchaCode" @refresh="loadCaptcha" />
 *
 * props:
 *   modelValue — 用户输入的字符
 *   svg        — 后端 / mock 返回的 SVG 源码
 *   error      — 错误文案（挂在输入框上）
 *   loading    — 正在取图；此时按钮禁用
 * emits:
 *   update:modelValue / refresh
 */
import { computed, ref } from 'vue'
import { RefreshCw, ShieldCheck } from 'lucide-vue-next'
import AuthField from './AuthField.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  svg: { type: String, default: '' },
  error: { type: String, default: '' },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'refresh'])

const fieldRef = ref(null)

const dataUrl = computed(() => {
  if (!props.svg) return ''
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(props.svg)}`
})

function focus() {
  fieldRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="captcha-field">
    <div class="captcha-row">
      <AuthField
        ref="fieldRef"
        class="captcha-input"
        :model-value="modelValue"
        label="图形验证码"
        placeholder="输入验证码"
        :icon="ShieldCheck"
        autocomplete="off"
        :maxlength="8"
        :error="error"
        name="captchaCode"
        @update:model-value="emit('update:modelValue', $event)"
      />

      <button
        type="button"
        class="captcha-image"
        :disabled="loading"
        :aria-label="loading ? '验证码加载中' : '换一张验证码'"
        @click="emit('refresh')"
      >
        <img v-if="dataUrl" :src="dataUrl" alt="图形验证码，点击换一张" />
        <span v-else class="captcha-placeholder">加载中…</span>
      </button>
    </div>

    <button type="button" class="captcha-refresh" :disabled="loading" @click="emit('refresh')">
      <RefreshCw :size="12" :stroke-width="2" aria-hidden="true" />
      换一张
    </button>
  </div>
</template>

<style scoped>
.captcha-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.captcha-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.captcha-input {
  flex: 1;
  min-width: 0;
}

.captcha-image {
  position: relative;
  flex: 0 0 120px;
  width: 120px;
  height: 46px;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: #f4efe3;
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-out);
}

.captcha-image:hover:not(:disabled) {
  border-color: var(--color-line-strong);
}

.captcha-image:disabled {
  cursor: progress;
}

.captcha-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.captcha-placeholder {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--color-muted);
  font-size: var(--text-caption);
}

.captcha-refresh {
  display: inline-flex;
  align-self: flex-end;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: 18px;
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease-out);
}

.captcha-refresh:hover:not(:disabled) {
  color: var(--color-primary);
}

.captcha-refresh:disabled {
  cursor: progress;
  opacity: 0.6;
}

@media (max-width: 374px) {
  .captcha-image {
    flex-basis: 104px;
    width: 104px;
  }
}
</style>
