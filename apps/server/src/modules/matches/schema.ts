import { z } from 'zod'
import { isValidLevelTenths } from '@shared/level/ntrp'
import { TRAINING_CAPACITY_MAX, TRAINING_CAPACITY_MIN } from '@shared/types/enums'
import { badRequest } from '../../lib/http-error'

const isoDateTime = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), '时间格式不正确')

// query 参数都是字符串，布尔与数字需要 coerce
const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true')
const queryLevelTenths = z.coerce
  .number()
  .int()
  .refine(isValidLevelTenths, '水平需为 1.0 - 7.0，且以 0.5 为步长')

export const matchListQuerySchema = z.object({
  city: z.string().trim().min(1).max(32).optional(),
  datePreset: z.enum(['today', 'tomorrow', 'weekend', 'week']).optional(),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
  levelTenths: queryLevelTenths.optional(),
  tolerance: z.coerce.number().int().min(0).max(20).optional(),
  fit: z.literal('me').optional(),
  free: booleanQuery.optional(),
  beginnerFriendly: booleanQuery.optional(),
  format: z.enum(['SINGLES', 'DOUBLES', 'TRAINING']).optional(),
  surface: z.enum(['HARD', 'CLAY', 'GRASS', 'INDOOR']).optional(),
  sort: z.enum(['recommend', 'time', 'fee']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
})

export const createMatchSchema = z
  .object({
    title: z.string().trim().min(2, '标题至少 2 个字').max(60, '标题最长 60 字'),
    city: z.string().trim().min(1, '请填写城市').max(32),
    venue: z.string().trim().min(2, '请填写场地').max(80),
    venueAddress: z.string().trim().max(160).optional(),
    startsAt: isoDateTime,
    durationMinutes: z.coerce.number().int().min(30).max(600).optional(),
    format: z.enum(['SINGLES', 'DOUBLES', 'TRAINING']).default('DOUBLES'),
    // 仅 TRAINING 需要：1 对 1 / 2 对 2 的人数由赛制写死，传了也忽略
    capacity: z.coerce.number().int().optional(),
    feeType: z.enum(['TREAT', 'AA', 'OTHER']).default('AA'),
    // fee 可空：TREAT 恒 0，AA 必填 > 0，OTHER 可空
    fee: z.coerce.number().min(0, '人均费用不能为负').max(9999).optional(),
    surface: z.enum(['HARD', 'CLAY', 'GRASS', 'INDOOR']).optional(),
    levelMinTenths: z.coerce
      .number()
      .int()
      .refine(isValidLevelTenths, '水平需为 1.0 - 7.0，且以 0.5 为步长'),
    levelMaxTenths: z.coerce
      .number()
      .int()
      .refine(isValidLevelTenths, '水平需为 1.0 - 7.0，且以 0.5 为步长'),
    beginnerFriendly: z.boolean().optional(),
    notes: z.string().trim().max(400, '备注最长 400 字').optional(),
  })
  .refine((value) => value.levelMinTenths <= value.levelMaxTenths, {
    message: '最低水平不能高于最高水平',
    path: ['levelMaxTenths'],
  })
  // 跨字段语义：赛制决定人数、费用类型决定金额是否为必填
  .superRefine((value, ctx) => {
    if (value.format === 'TRAINING') {
      if (value.capacity === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '练习局需要填写人数上限', path: ['capacity'] })
      } else if (value.capacity < TRAINING_CAPACITY_MIN || value.capacity > TRAINING_CAPACITY_MAX) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `练习局人数需在 ${TRAINING_CAPACITY_MIN} - ${TRAINING_CAPACITY_MAX} 人之间`,
          path: ['capacity'],
        })
      }
    }

    if (value.feeType === 'AA' && (value.fee === undefined || value.fee <= 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'AA 需要填写大于 0 的人均金额', path: ['fee'] })
    }
  })

export const joinMatchSchema = z.object({
  note: z.string().trim().max(100, '备注最长 100 字').optional(),
})

export const registrationsQuerySchema = z.object({
  scope: z.enum(['upcoming', 'past']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
})

// 路由里路径参数一律经此解析：失败即 400，而不是把 NaN 丢给 Prisma
// （Express 5 的 params 类型是 string | string[]）
export function parseMatchId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('约球 ID 不正确')
  return id
}