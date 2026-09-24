import { z } from 'zod'
import { isValidLevelTenths } from '@shared/level/ntrp'

export const levelTenthsSchema = z
  .number()
  .refine(isValidLevelTenths, '水平需为 1.0 - 7.0，且以 0.5 为步长')

export const registerSchema = z.object({
  account: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_.@-]{4,32}$/, '账号需为 4-32 位字母、数字或 _ . @ -'),
  password: z.string().min(6, '密码至少 6 位').max(64, '密码最长 64 位'),
  nickname: z.string().trim().min(1, '请填写昵称').max(20, '昵称最长 20 字'),
  levelTenths: levelTenthsSchema.optional(),
  city: z.string().trim().min(1).max(32).optional(),
  district: z.string().trim().min(1).max(32).optional(),
})

export const loginSchema = z.object({
  account: z.string().trim().min(1, '请输入账号'),
  password: z.string().min(1, '请输入密码'),
})