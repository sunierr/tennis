// 统一的业务错误族：service 只负责 throw，HTTP 状态码与响应体由 middleware/error.ts 组装。
import type { ErrorCode } from '@shared/types/api'

export class AppError extends Error {
  readonly status: number
  readonly code: ErrorCode
  readonly details?: unknown

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function badRequest(message = '参数有误', details?: unknown): AppError {
  return new AppError(400, 'VALIDATION_ERROR', message, details)
}

export function unauthorized(message = '请先登录'): AppError {
  return new AppError(401, 'UNAUTHORIZED', message)
}

export function forbidden(message = '没有权限执行该操作'): AppError {
  return new AppError(403, 'FORBIDDEN', message)
}

export function notFound(message = '内容不存在或已被删除'): AppError {
  return new AppError(404, 'NOT_FOUND', message)
}

// 频率限制：发帖这类「同一动作短时间重复」的场景用 429，前端提示等一会儿再发
export function tooManyRequests(message = '操作太频繁，请稍后再试'): AppError {
  return new AppError(429, 'RATE_LIMITED', message)
}

export type ConflictCode = Extract<ErrorCode, 'ACCOUNT_EXISTS' | 'ALREADY_JOINED' | 'MATCH_FULL' | 'MATCH_NOT_OPEN'>

export function conflict(code: ConflictCode, message: string): AppError {
  return new AppError(409, code, message)
}