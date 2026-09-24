// 把任意异常转成可直接展示的中文文案。ApiError 的 message 由服务端给出（已是中文）。

import { isApiError } from '@shared/http/client'

export function errorMessage(error: unknown, fallback = '操作失败，请稍后重试'): string {
  if (isApiError(error)) return error.message || fallback
  return fallback
}