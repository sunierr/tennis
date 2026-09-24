import type { NextFunction, Request, Response } from 'express'
import { unauthorized } from '../lib/http-error'
import { verifyAuthToken } from '../lib/jwt'

export interface AuthContext {
  userId: number
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (!token || scheme?.toLowerCase() !== 'bearer') return null
  return token
}

// 必须登录：缺 token / token 失效一律 401
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readBearerToken(req)
  if (!token) throw unauthorized('请先登录')
  req.auth = { userId: verifyAuthToken(token).sub }
  next()
}

// 可选登录：带了有效 token 就注入身份（用于水平匹配），无效则按游客继续
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readBearerToken(req)
  if (token) {
    try {
      req.auth = { userId: verifyAuthToken(token).sub }
    } catch {
      req.auth = undefined
    }
  }
  next()
}

// 仅用于 requireAuth / optionalAuth 之后的路由，避免到处 `req.auth!`
export function currentUserId(req: Request): number {
  if (!req.auth) throw unauthorized('请先登录')
  return req.auth.userId
}