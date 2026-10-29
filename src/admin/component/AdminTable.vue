<script setup>
/**
 * 后台表格
 *
 * 用途：用户台账与反馈列表共用的表头 / 骨架 / 空态 / 行点击容器。
 *       单元格内容由调用方通过 `#cell-<key>` 插槽渲染，避免把业务格式塞进组件。
 * 用法：<AdminTable :columns="columns" :rows="rows" :loading="loading" clickable @row-click="open">
 *         <template #cell-user="{ row }">…</template>
 *         <template #empty><EmptyState … /></template>
 *       </AdminTable>
 *
 * props:
 *   columns     — [{ key, label, width? }]
 *   rows        — 数据数组
 *   rowKey      — 行主键字段，默认 id
 *   loading     — 首屏骨架；已有数据时不遮住旧表格
 *   clickable   — 行可点击并可键盘进入
 *   skeletonRows— 骨架行数，默认 8
 *   minWidth    — 表格最小宽度，默认 1120px；详情页的内嵌表格可以更窄
 * emits:
 *   row-click — 行点击 / Enter
 */
import SkeletonBlock from '../../component/SkeletonBlock.vue'

const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, default: () => [] },
  rowKey: { type: String, default: 'id' },
  loading: { type: Boolean, default: false },
  clickable: { type: Boolean, default: false },
  skeletonRows: { type: Number, default: 8 },
  minWidth: { type: String, default: '1120px' },
})

const emit = defineEmits(['row-click'])

function emitRow(row) {
  if (!props.clickable) return
  emit('row-click', row)
}
</script>

<template>
  <div class="table-wrap">
    <table class="table" :style="{ minWidth }">
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            :style="{ width: column.width || 'auto' }"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>

      <tbody v-if="loading && !rows.length">
        <tr v-for="index in skeletonRows" :key="`skeleton-${index}`" class="skeleton-row">
          <td v-for="column in columns" :key="column.key">
            <SkeletonBlock height="18px" width="70%" />
          </td>
        </tr>
      </tbody>

      <tbody v-else>
        <tr
          v-for="row in rows"
          :key="row[rowKey]"
          :class="{ 'is-clickable': clickable }"
          :tabindex="clickable ? 0 : undefined"
          @click="emitRow(row)"
          @keydown.enter="emitRow(row)"
        >
          <td v-for="column in columns" :key="column.key">
            <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]">{{
              row[column.key]
            }}</slot>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="!loading && !rows.length" class="table-empty">
      <slot name="empty" />
    </div>
  </div>
</template>

<style scoped>
.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.table {
  width: 100%;
  min-width: 1120px;
  border-collapse: collapse;
  font-size: 14px;
  line-height: 22px;
}

.table th {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-line);
  background: var(--color-surface-2);
  color: var(--color-muted);
  font-size: var(--text-caption);
  font-weight: 500;
  line-height: var(--leading-caption);
  letter-spacing: 0.08em;
  text-align: left;
  white-space: nowrap;
}

.table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-line);
  color: var(--color-ink-2);
  vertical-align: middle;
}

.table tbody tr:last-child td {
  border-bottom: none;
}

.table tbody tr.is-clickable {
  cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease-out);
}

.table tbody tr.is-clickable:hover {
  background: var(--color-selected-bg);
}

.table tbody tr.is-clickable:focus-visible {
  outline: none;
  background: var(--color-selected-bg);
  box-shadow: inset 0 0 0 2px var(--focus-ring);
}

.table .skeleton-row td {
  padding-top: 16px;
  padding-bottom: 16px;
}

/* 单元格内容由调用方的插槽渲染，样式必须穿透 scoped */
:deep(.cell-main) {
  display: block;
  color: var(--color-ink);
  font-size: 14px;
  line-height: 22px;
}

:deep(.cell-sub) {
  display: block;
  color: var(--color-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-caption);
}

:deep(.num) {
  font-variant-numeric: tabular-nums;
}

:deep(.is-muted) {
  color: var(--color-muted-2);
}

:deep(.is-warning) {
  color: var(--color-warning);
}

:deep(.is-success) {
  color: var(--color-success);
}

.table-empty {
  padding: var(--space-10) var(--space-6);
}
</style>
