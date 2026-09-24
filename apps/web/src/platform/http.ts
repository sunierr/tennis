// 全站唯一的 axios 接触点（迁移小程序 → uni.request）。
// 这里只做「把 axios 的结果翻译成 HttpAdapter 契约」，鉴权头/query/错误映射
// 全部在 shared/http/client.ts 里完成。

import axios from 'axios'
import { createHttpClient, toApiError } from '@shared/http/client'
import type { HttpAdapter, HttpRequest, HttpResponse } from '@shared/http/types'
import { API_BASE_URL } from './env'
import { clearToken, readToken } from './storage'

const axiosAdapter: HttpAdapter = {
  async request<T>(req: HttpRequest): Promise<HttpResponse<T>> {
    const response = await axios.request<T>({
      url: req.path,
      method: req.method,
      data: req.body,
      headers: req.headers,
      // 4xx/5xx 不抛异常：统一交给 shared client 判定并转成 ApiError
      validateStatus: () => true,
    })
    return { status: response.status, data: response.data }
  },
}

// 会话失效的回调由 user store 注册，避免 platform 层反向依赖 store
let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler
}

export const http = createHttpClient(axiosAdapter, {
  baseURL: API_BASE_URL,
  getToken: readToken,
  onUnauthorized: () => {
    clearToken()
    unauthorizedHandler?.()
  },
})

// multipart 请求（文件上传）走这里：axios 只在本文件出现，业务侧统一调 platform/upload.ts。
// 迁移小程序时换成 uni.uploadFile，本文件与 upload.ts 是仅有的两个改动点。
export async function postForm<T>(path: string, form: FormData): Promise<T> {
  const token = readToken()
  const response = await axios.request<T>({
    url: `${API_BASE_URL}${path}`,
    method: 'POST',
    data: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    validateStatus: () => true,
  })

  if (response.status >= 400) {
    const error = toApiError(response.status, response.data)
    if (error.status === 401) {
      clearToken()
      unauthorizedHandler?.()
    }
    throw error
  }
  return response.data
}