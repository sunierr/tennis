import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'
import { badRequest } from '../lib/http-error'

export type ValidateSource = 'body' | 'query' | 'params'

declare global {
  namespace Express {
    interface Request {
      validated?: unknown
    }
  }
}

// 校验结果统一放在 req.validated：Express 5 的 req.query 是只读 getter，不能回写
export function validate(schema: ZodType, source: ValidateSource = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))
      next(badRequest(details[0]?.message ?? '参数有误', details))
      return
    }
    req.validated = result.data
    next()
  }
}