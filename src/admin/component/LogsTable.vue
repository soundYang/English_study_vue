<script setup>
/**
 * 日志列表外壳
 *
 * 用途：访问 / 报错 / 登录三个日志 tab 共用的「工具栏 + 表格 + 空态 + 分页」容器。
 *       页面只负责筛选条件、取数与 `#cell-<key>` 单元格，外壳统一处理错误条、
 *       旧数据置灰与分页大小，避免三份列表各写一遍。
 * 用法：<LogsTable :columns="COLUMNS" :rows="rows" … @update:page="page = $event">
 *         <template #filters>…筛选控件…</template>
 *         <template #cell-time="{ row }">…</template>
 *       </LogsTable>
 *
 * props:
 *   columns / rows / total / loading — 同 AdminTable 与 PaginationBar
 *   errorMessage — 请求失败文案；有旧数据时整块置灰（stale-while-revalidate）
 *   page / size  — 当前页与每页条数（受控，由调用方持有）
 *   rowKey       — 行主键，默认 id
 *   minWidth     — 表格最小宽度，日志列多可自行加宽
 *   note         — 工具栏左侧的计数说明
 *   emptyTitle / emptyDescription — 空态文案
 *   rowClass     — (row) => string，按行追加类名
 * emits:
 *   update:page / update:size — 分页与每页数量
 *   retry — 点「重试」
 *   reset — 点空态里的「清空筛选」
 * slots:
 *   filters — 工具栏右侧的筛选控件
 *   cell-<key> — 单元格内容
 */
import BaseButton from '../../component/BaseButton.vue'
import DropdownSelect from '../../component/DropdownSelect.vue'
import EmptyState from '../../component/EmptyState.vue'
import PaginationBar from '../../component/PaginationBar.vue'
import AdminTable from './AdminTable.vue'
import { LOG_PAGE_SIZES } from '../log-options'

const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
  page: { type: Number, default: 1 },
  size: { type: Number, default: 20 },
  rowKey: { type: String, default: 'id' },
  minWidth: { type: String, default: '1120px' },
  note: { type: String, default: '' },
  emptyTitle: { type: String, required: true },
  emptyDescription: { type: String, default: '' },
  rowClass: { type: Function, default: null },
})

const emit = defineEmits(['update:page', 'update:size', 'retry', 'reset'])

function handleSizeChange(value) {
  emit('update:size', Number(value))
}
</script>

<template>
  <section class="logs-table">
    <div class="toolbar">
      <p class="toolbar-note">{{ note }}</p>

      <div class="filters">
        <slot name="filters" />
        <DropdownSelect
          :model-value="size"
          :options="LOG_PAGE_SIZES"
          aria-label="每页数量"
          align="end"
          @update:model-value="handleSizeChange"
        />
      </div>
    </div>

    <div v-if="errorMessage" class="error-strip" role="alert">
      <span>{{ errorMessage }}</span>
      <button type="button" class="error-action" @click="emit('retry')">重试</button>
    </div>

    <!-- 首屏失败时只留错误条：空态「没有记录」会把加载失败说成真的没有 -->
    <div
      v-if="rows.length || loading || !errorMessage"
      :class="{ 'is-stale': errorMessage && rows.length }"
    >
      <AdminTable
        :columns="columns"
        :rows="rows"
        :row-key="rowKey"
        :loading="loading"
        :min-width="minWidth"
        :row-class="rowClass"
      >
        <template v-for="column in columns" :key="column.key" #[`cell-${column.key}`]="slotProps">
          <slot :name="`cell-${column.key}`" v-bind="slotProps">{{ slotProps.value }}</slot>
        </template>

        <template #empty>
          <EmptyState :title="emptyTitle" :description="emptyDescription">
            <template #actions>
              <BaseButton variant="secondary" @click="emit('reset')">清空筛选</BaseButton>
            </template>
          </EmptyState>
        </template>
      </AdminTable>
    </div>

    <PaginationBar
      v-if="rows.length || !errorMessage"
      :page="page"
      :total="total"
      :page-size="size"
      @update:page="emit('update:page', $event)"
    />
  </section>
</template>

<style scoped>
.logs-table {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.toolbar-note {
  color: var(--color-muted);
  font-size: var(--text-small);
  line-height: var(--leading-small);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
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

/* 旧数据留在屏幕上但明确变灰，告诉管理员「这不是最新的」 */
.is-stale {
  opacity: 0.55;
}

/* 5xx 用红色；AdminTable 只内置了 warning / success / muted 三档 */
:deep(.is-danger) {
  color: var(--color-danger);
}

@media (max-width: 767px) {
  .filters {
    width: 100%;
  }
}
</style>
