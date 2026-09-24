// 平台无关的 HTTP 核心：拼 query、注入鉴权头、把 >=400 统一转成 ApiError。
// 这里出现的平台 API 数量必须是 0 —— 平台差异全部由 HttpAdapter 吸收。

import type { ApiErrorBody, ErrorCode } from '../types/api'
import type { HttpRequest, HttpAdapter } from './types'

export class ApiError extends Error {
  status: number
  code: ErrorCode | string
  details?: unknown

  constructor(status: number, code: ErrorCode | string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }
}

export interface HttpClientOptions {
  baseURL?: string
  getToken?: () => string | null
  onUnauthorized?: () => void
}

export interface HttpClient {
  request<T>(req: HttpRequest): Promise<T>
}

export function buildQueryString(query?: object): string {
  if (!query) return ''
  const parts: string[] = []
  for (const [key, raw] of Object.entries(query as Record<string, unknown>)) {
    // 跳过 undefined / null：让「未选择」天然等价于「不加该条件」
    if (raw === undefined || raw === null || raw === '') continue
    const values = Array.isArray(raw) ? raw : [raw]
    for (const value of values) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : ''
}

function joinURL(baseURL: string, path: string): string {
  if (!baseURL) return path
  return `${baseURL.replace(/\/+$/, '')}${path}`
}

// 服务端错误体可能是字符串（网关/代理）或非 JSON，这里做容错解析
export function toApiError(status: number, data: unknown): ApiError {
  let body = data
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = undefined
    }
  }
  const parsed = (body ?? {}) as Partial<ApiErrorBody>
  const code = parsed.code ?? (status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR')
  const message = parsed.message ?? defaultMessageFor(status)
  return new ApiError(status, code, message, parsed.details)
}

function defaultMessageFor(status: number): string {
  if (status === 401) return '登录状态已失效，请重新登录'
  if (status === 403) return '没有权限执行该操作'
  if (status === 404) return '内容不存在或已被删除'
  if (status >= 500) return '服务暂时不可用，请稍后重试'
  return '请求失败，请重试'
}

export function createHttpClient(adapter: HttpAdapter, options: HttpClientOptions = {}): HttpClient {
  const { baseURL = '', getToken, onUnauthorized } = options

  return {
    async request<T>(req: HttpRequest): Promise<T> {
      const token = getToken?.() ?? null
      const response = await adapter.request<T>({
        ...req,
        path: joinURL(baseURL, req.path) + buildQueryString(req.query),
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...req.headers,
        },
      })

      if (response.status >= 400) {
        const error = toApiError(response.status, response.data)
        if (error.status === 401) onUnauthorized?.()
        throw error
      }
      return response.data
    },
  }
}

// 供 endpoints 与调用方判断错误类型
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}