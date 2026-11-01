<script setup>
/**
 * 基础组件预览（仅开发环境）
 *
 * 用途：F2 阶段集中检查按钮、输入、弹窗、Toast、胶囊、分段、分页、下拉、空状态与骨架
 * 用法：开发环境访问 /dev/components；生产路由表不会注册该页面
 * 说明：该页面在正式页面全部接入后删除
 */
import { ref } from 'vue'
import { Pencil, Trash2 } from 'lucide-vue-next'
import BaseButton from '../../component/BaseButton.vue'
import BaseInput from '../../component/BaseInput.vue'
import BaseModal from '../../component/BaseModal.vue'
import ConfirmDialog from '../../component/ConfirmDialog.vue'
import StatusPill from '../../component/StatusPill.vue'
import SegmentedControl from '../../component/SegmentedControl.vue'
import PaginationBar from '../../component/PaginationBar.vue'
import DropdownSelect from '../../component/DropdownSelect.vue'
import EmptyState from '../../component/EmptyState.vue'
import SkeletonBlock from '../../component/SkeletonBlock.vue'
import { useToast } from '../../composables/useToast'
import wordsBook from '../../assets/images/words-book.png'

const toast = useToast()

const keyword = ref('')
const page = ref(1)
const count = ref(5)
const filter = ref('all')
const level = ref('')
const modalOpen = ref(false)
const confirmOpen = ref(false)
const confirmLoading = ref(false)

const countOptions = [
  { value: 3, label: '3 题' },
  { value: 5, label: '5 题' },
  { value: 8, label: '8 题' },
]

const filterOptions = [
  { value: 'all', label: '全部', count: 120 },
  { value: 'new', label: '新词', count: 20 },
  { value: 'reviewing', label: '复习中', count: 35 },
  { value: 'mastered', label: '已掌握', count: 65 },
]

const levelOptions = [
  { value: '', label: '全部难度' },
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '进阶' },
  { value: 'hard', label: '挑战' },
]

function showToast(type, message, duration) {
  const payload = { duration }
  if (type === 'success') toast.success(message, payload)
  else if (type === 'error') toast.error(message, payload)
  else toast.info(message, payload)
}

function handleConfirm() {
  confirmLoading.value = true
  window.setTimeout(() => {
    confirmLoading.value = false
    confirmOpen.value = false
    toast.success('已删除 apple')
  }, 800)
}
</script>

<template>
  <section class="page preview">
    <p class="page-eyebrow">Development Only</p>
    <h1 class="page-title">基础组件预览</h1>
    <p class="page-desc">F2 阶段临时页面，仅开发环境注册路由。正式页面接入后删除。</p>

    <article class="demo">
      <h2 class="demo-title">按钮 BaseButton</h2>
      <div class="demo-row">
        <BaseButton>主按钮</BaseButton>
        <BaseButton variant="secondary">次要按钮</BaseButton>
        <BaseButton variant="ghost">幽灵按钮</BaseButton>
        <BaseButton variant="danger">危险按钮</BaseButton>
      </div>
      <div class="demo-row">
        <BaseButton size="sm">小号</BaseButton>
        <BaseButton size="md">中号</BaseButton>
        <BaseButton size="lg">大号</BaseButton>
        <BaseButton loading>加载中</BaseButton>
        <BaseButton disabled>禁用</BaseButton>
      </div>
      <div class="demo-row">
        <BaseButton variant="ghost" icon-only aria-label="编辑">
          <Pencil :size="16" :stroke-width="1.8" />
        </BaseButton>
        <BaseButton variant="ghost" icon-only aria-label="删除">
          <Trash2 :size="16" :stroke-width="1.8" />
        </BaseButton>
      </div>
    </article>

    <article class="demo">
      <h2 class="demo-title">输入框 BaseInput</h2>
      <div class="demo-grid">
        <BaseInput v-model="keyword" label="搜索单词" placeholder="搜索单词或释义…" />
        <BaseInput
          v-model="keyword"
          label="英文单词"
          placeholder="请输入英文单词"
          hint="单词会统一转为小写保存。"
        />
        <BaseInput
          v-model="keyword"
          label="英文单词"
          placeholder="请输入英文单词"
          error="这个单词已经在词库中了"
        />
      </div>
    </article>

    <article class="demo">
      <h2 class="demo-title">状态胶囊 StatusPill</h2>
      <div class="demo-row">
        <StatusPill kind="status" value="new" />
        <StatusPill kind="status" value="reviewing" />
        <StatusPill kind="status" value="mastered" />
        <StatusPill kind="status" value="removed" />
      </div>
      <div class="demo-row">
        <StatusPill kind="level" value="easy" />
        <StatusPill kind="level" value="medium" />
        <StatusPill kind="level" value="hard" />
      </div>
    </article>

    <article class="demo">
      <h2 class="demo-title">分段控件 SegmentedControl</h2>
      <div class="demo-row">
        <SegmentedControl v-model="count" :options="countOptions" aria-label="题目数量" />
        <span class="demo-value">当前：{{ count }} 题</span>
      </div>
      <div class="demo-row">
        <SegmentedControl v-model="filter" :options="filterOptions" aria-label="学习状态筛选" />
        <span class="demo-value">当前：{{ filter }}</span>
      </div>
    </article>

    <article class="demo">
      <h2 class="demo-title">分页 PaginationBar</h2>
      <div class="demo-row">
        <PaginationBar v-model:page="page" :total="120" :page-size="10" />
        <span class="demo-value">当前页：{{ page }}</span>
      </div>
    </article>

    <article class="demo">
      <h2 class="demo-title">下拉选择 DropdownSelect</h2>
      <div class="demo-row">
        <DropdownSelect
          v-model="level"
          :options="levelOptions"
          aria-label="按难度筛选"
          align="start"
        />
        <span class="demo-value">当前：{{ level || '全部' }}</span>
      </div>
    </article>

    <article class="demo">
      <h2 class="demo-title">空状态 EmptyState</h2>
      <div class="demo-columns">
        <EmptyState
          title="还没有单词"
          description="先添加第一个单词，开始你的阅读训练。"
          action-text="添加单词"
          @action="toast.info('触发添加单词')"
        />
        <EmptyState
          :image="wordsBook"
          title="没有找到匹配的单词"
          description="换个关键词试试，或清除搜索。"
          compact
        />
      </div>
    </article>

    <article class="demo">
      <h2 class="demo-title">骨架 SkeletonBlock</h2>
      <div class="demo-skeleton">
        <SkeletonBlock width="40px" height="40px" circle />
        <div class="demo-skeleton-lines">
          <SkeletonBlock width="60%" height="18px" />
          <SkeletonBlock width="100%" height="14px" />
          <SkeletonBlock width="80%" height="14px" />
        </div>
      </div>
    </article>

    <article class="demo">
      <h2 class="demo-title">弹窗与提示</h2>
      <div class="demo-row">
        <BaseButton variant="secondary" @click="modalOpen = true">打开弹窗</BaseButton>
        <BaseButton variant="secondary" @click="confirmOpen = true">删除确认</BaseButton>
        <BaseButton variant="ghost" @click="showToast('success', '已添加 apple')">
          成功 Toast
        </BaseButton>
        <BaseButton variant="ghost" @click="showToast('error', '网络出了点问题，请稍后重试。')">
          错误 Toast
        </BaseButton>
        <BaseButton variant="ghost" @click="showToast('info', '设置已保存')">
          信息 Toast
        </BaseButton>
      </div>
    </article>

    <BaseModal v-model:open="modalOpen" title="编辑单词" description="修改后立即生效。">
      <BaseInput v-model="keyword" label="英文单词" placeholder="请输入英文单词" />
      <template #footer>
        <BaseButton variant="secondary" @click="modalOpen = false">取消</BaseButton>
        <BaseButton @click="modalOpen = false">保存</BaseButton>
      </template>
    </BaseModal>

    <ConfirmDialog
      v-model:open="confirmOpen"
      title="删除 “apple”？"
      description="历史阅读中的词汇快照不会受影响。"
      confirm-text="删除"
      danger
      :loading="confirmLoading"
      @confirm="handleConfirm"
    />
  </section>
</template>

<style scoped>
.preview {
  padding-bottom: var(--space-16);
}

.demo {
  margin-top: var(--space-6);
  padding: var(--space-6);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.demo-title {
  margin-bottom: var(--space-4);
  color: var(--color-ink);
  font-size: var(--text-section);
  line-height: var(--leading-section);
}

.demo-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.demo-row + .demo-row {
  margin-top: var(--space-4);
}

.demo-grid {
  display: grid;
  gap: var(--space-4);
  max-width: 420px;
}

.demo-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.demo-value {
  color: var(--color-muted);
  font-size: var(--text-small);
}

.demo-skeleton {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.demo-skeleton-lines {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-2);
}

@media (max-width: 767px) {
  .demo-columns {
    grid-template-columns: 1fr;
  }
}
</style>
