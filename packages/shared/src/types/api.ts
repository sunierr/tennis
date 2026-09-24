// 统一响应形态：成功直接返回资源或 Paginated<T>，失败一律 { code, message, details? }

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'ACCOUNT_EXISTS'
  | 'ALREADY_JOINED'
  | 'MATCH_FULL'
  | 'MATCH_NOT_OPEN'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

export interface ApiErrorBody {
  code: ErrorCode
  // 中文，可直接展示给用户
  message: string
  details?: unknown
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface HealthResponse {
  ok: true
  db: 'up'
}