// NTRP 自评水平：1.0 - 7.0，0.5 一档。
// 存储与计算一律用 ×10 整数（35 = 3.5 级）：不用 Float（比较/区间/排序不可靠），
// 不用 String（无法查询排序）。整数十分位天然支持「±0.5 级容差 = ±5」。

export const LEVEL_TENTHS_MIN = 10
export const LEVEL_TENTHS_MAX = 70
export const LEVEL_TENTHS_STEP = 5
// 默认容差 ±0.5 级
export const LEVEL_TOLERANCE_DEFAULT = 5

export type LevelTier = 'BEGINNER' | 'CASUAL' | 'ADVANCED' | 'COMPETITIVE'

// 档位文案不落库，由纯函数从 levelTenths 推导，避免双写不一致
export const LEVEL_TIER_LABELS: Record<LevelTier, string> = {
  BEGINNER: '入门',
  CASUAL: '休闲',
  ADVANCED: '进阶',
  COMPETITIVE: '竞赛',
}

export const LEVEL_OPTIONS: number[] = Array.from(
  { length: (LEVEL_TENTHS_MAX - LEVEL_TENTHS_MIN) / LEVEL_TENTHS_STEP + 1 },
  (_, i) => LEVEL_TENTHS_MIN + i * LEVEL_TENTHS_STEP,
)

export function isValidLevelTenths(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= LEVEL_TENTHS_MIN &&
    value <= LEVEL_TENTHS_MAX &&
    value % LEVEL_TENTHS_STEP === 0
  )
}

// 35 → "3.5"；null/undefined → "未填写"
export function formatLevel(tenths: number | null | undefined): string {
  if (typeof tenths !== 'number' || !Number.isFinite(tenths)) return '未填写'
  return (tenths / 10).toFixed(1)
}

// "3.5" → 35；非法输入 → null
export function parseLevel(text: string | number | null | undefined): number | null {
  if (text === null || text === undefined || text === '') return null
  const value = typeof text === 'number' ? text : Number(String(text).trim())
  if (!Number.isFinite(value)) return null
  const tenths = Math.round(value * 10)
  return isValidLevelTenths(tenths) ? tenths : null
}

// 把任意数值吸附到最近的合法档位并夹在 10..70
export function snapLevelTenths(value: number): number {
  const snapped = Math.round(value / LEVEL_TENTHS_STEP) * LEVEL_TENTHS_STEP
  return Math.min(LEVEL_TENTHS_MAX, Math.max(LEVEL_TENTHS_MIN, snapped))
}

export function levelTier(tenths: number): LevelTier {
  if (tenths <= 20) return 'BEGINNER'
  if (tenths <= 30) return 'CASUAL'
  if (tenths <= 45) return 'ADVANCED'
  return 'COMPETITIVE'
}

export function levelTierLabel(tenths: number): string {
  return LEVEL_TIER_LABELS[levelTier(tenths)]
}

// 单值 → "3.5 级"；区间 → "2.5 - 3.0 级"
export function formatLevelRange(min: number, max: number): string {
  if (min === max) return `${formatLevel(min)} 级`
  return `${formatLevel(min)} - ${formatLevel(max)} 级`
}

// 原型卡片风格："休闲 2.5 - 3.0 级"（档位取区间中点）
export function formatLevelRangeWithTier(min: number, max: number): string {
  const tier = levelTierLabel(Math.round((min + max) / 2))
  return `${tier} ${formatLevelRange(min, max)}`
}