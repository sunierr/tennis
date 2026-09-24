import { z } from 'zod'
import { levelTenthsSchema } from '../auth/schema'

export const updateProfileSchema = z
  .object({
    nickname: z.string().trim().min(1, '昵称不能为空').max(20, '昵称最长 20 字').optional(),
    levelTenths: levelTenthsSchema.optional(),
    city: z.string().trim().min(1).max(32).optional(),
    district: z.string().trim().min(1).max(32).optional(),
    bio: z.string().trim().max(140, '简介最长 140 字').optional(),
  })
  .refine((value) => Object.keys(value).length > 0, '没有需要更新的字段')