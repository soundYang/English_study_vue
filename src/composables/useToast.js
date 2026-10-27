/**
 * Toast 组合式函数
 * 用法：const toast = useToast(); toast.success('已添加 apple')
 * 业务侧只关心语义化的三种类型，队列与计时细节由 toast store 负责。
 */
import { useToastStore } from '../stores/model/toast'

export function useToast() {
  const store = useToastStore()

  return {
    success: (message, options = {}) => store.push({ ...options, type: 'success', message }),
    error: (message, options = {}) => store.push({ ...options, type: 'error', message }),
    info: (message, options = {}) => store.push({ ...options, type: 'info', message }),
    remove: (id) => store.remove(id),
    clear: () => store.clear(),
  }
}
