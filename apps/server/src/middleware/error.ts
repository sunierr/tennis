import { Prisma } from '@prisma/client'
import type { ErrorRequestHandler, RequestHandler } from 'express'
import { AppError } from '../lib/http-error'

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: `接口不存在：${req.method} ${req.path}` })
}

// 唯一的错误出口：AppError → 原样映射；Prisma 唯一约束冲突 → 按语义区分；
// 其余一律 500 且不泄漏堆栈。
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      code: err.code,
      message: err.message,
      ...(err.details === undefined ? {} : { details: err.details }),
    })
    return
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      // 报名与注册各有一个唯一索引，靠 meta.target 区分
      const target = Array.isArray(err.meta?.target) ? (err.meta?.target as string[]) : []
      if (target.includes('matchId')) {
        res.status(409).json({ code: 'ALREADY_JOINED', message: '你已经报名过了' })
        return
      }
      res.status(409).json({ code: 'ACCOUNT_EXISTS', message: '该账号已被注册' })
      return
    }
    if (err.code === 'P2025') {
      res.status(404).json({ code: 'NOT_FOUND', message: '内容不存在或已被删除' })
      return
    }
  }

  console.error('[error]', err)
  res.status(500).json({ code: 'INTERNAL_ERROR', message: '服务暂时不可用，请稍后重试' })
}