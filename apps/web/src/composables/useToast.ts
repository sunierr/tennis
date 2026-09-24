import { storeToRefs } from 'pinia'
import { useUiStore } from '../stores/ui'

// 组件里用 toast.success(...) / toast.error(...)，不直接碰 ui store 的细节。
// toasts 必须经 storeToRefs 取出：直接解构 store 属性会拿到当时的快照值，之后 push
// 进来的 toast 不会触发渲染（这个坑一旦踩了表现为「toast 完全不出」）。
export function useToast() {
  const ui = useUiStore()
  const { toasts } = storeToRefs(ui)
  return {
    toasts,
    toast: ui.push,
    success: ui.success,
    error: ui.error,
    dismiss: ui.dismiss,
  }
}