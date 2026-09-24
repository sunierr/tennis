import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastTone = 'info' | 'error'

export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

const TOAST_DURATION = 2400

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<ToastItem[]>([])
  // 顶栏标题的运行期覆盖：聊天页要显示对方昵称 / 球局标题，静态 meta.title 表达不了
  const pageTitle = ref<string | null>(null)
  let seq = 0

  function setPageTitle(title: string | null): void {
    pageTitle.value = title
  }

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function push(message: string, tone: ToastTone = 'info', duration = TOAST_DURATION): void {
    const id = (seq += 1)
    toasts.value = [...toasts.value, { id, message, tone }]
    setTimeout(() => dismiss(id), duration)
  }

  function success(message: string): void {
    push(message, 'info')
  }

  function error(message: string): void {
    push(message, 'error')
  }

  return { toasts, pageTitle, setPageTitle, push, success, error, dismiss }
})