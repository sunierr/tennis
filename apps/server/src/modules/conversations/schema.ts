import { z } from 'zod'
import { badRequest } from '../../lib/http-error'

export const messageQuerySchema = z.object({
  beforeId: z.coerce.number().int().positive().optional(),
  afterId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const sendMessageSchema = z.object({
  // SYSTEM 只由服务端产生，客户端不允许指定
  type: z.enum(['TEXT', 'IMAGE']).default('TEXT'),
  content: z.string().trim().min(1, '消息内容不能为空').max(1000, '消息最长 1000 字'),
})

export const directConversationSchema = z.object({
  userId: z.coerce.number().int().positive(),
})

export const markReadSchema = z.object({
  lastReadMessageId: z.coerce.number().int().min(0),
})

// 路径参数一律经此解析：失败即 400，而不是把 NaN 丢给 Prisma
export function parseConversationId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('会话 ID 不正确')
  return id
}