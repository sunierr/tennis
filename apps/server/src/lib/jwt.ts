import jwt from 'jsonwebtoken'
import { env } from '../env'
import { unauthorized } from './http-error'

const EXPIRES_IN = '30d'

export interface AuthTokenPayload {
  sub: number
}

export function signAuthToken(userId: number): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: EXPIRES_IN })
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  let payload: string | jwt.JwtPayload
  try {
    payload = jwt.verify(token, env.JWT_SECRET)
  } catch {
    throw unauthorized('登录状态已失效，请重新登录')
  }
  if (typeof payload === 'string' || typeof payload.sub !== 'number') {
    throw unauthorized('登录状态已失效，请重新登录')
  }
  return { sub: payload.sub }
}