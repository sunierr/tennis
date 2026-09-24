// 「水平相近」匹配算法：Web / Node / 小程序三端共用，纯函数、可单测。
// 三段式：区间距离 → 硬容差判定 → 综合推荐分（排序在服务端 JS 做，不用 SQL ORDER BY）。

import { LEVEL_FIT_LABELS, type LevelFit } from '../types/enums'
import { LEVEL_TOLERANCE_DEFAULT } from './ntrp'

export type LevelDirection = 'SAME' | 'HIGHER' | 'LOWER'

// 落在区间内 = 0；低于下界/高于上界取实际差值
export function levelDistance(my: number, min: number, max: number): number {
  if (my < min) return min - my
  if (my > max) return my - max
  return 0
}

export function levelFit(my: number, min: number, max: number, tolerance = LEVEL_TOLERANCE_DEFAULT): LevelFit {
  const distance = levelDistance(my, min, max)
  if (distance === 0) return 'IN_RANGE'
  return distance <= tolerance ? 'NEAR' : 'FAR'
}

// 该局要求相对我的水平是偏高还是偏低（用于「略高一点 / 略低一点」）
export function levelDirection(my: number, min: number, max: number): LevelDirection {
  if (my < min) return 'HIGHER'
  if (my > max) return 'LOWER'
  return 'SAME'
}

// 保持「水平合适 / 略高一点 / 差得多」三态语义
export function levelFitText(fit: LevelFit, direction: LevelDirection): string {
  if (fit === 'IN_RANGE') return LEVEL_FIT_LABELS.IN_RANGE
  if (fit === 'FAR') return LEVEL_FIT_LABELS.FAR
  return direction === 'HIGHER' ? '略高一点' : '略低一点'
}

export interface RecommendInput {
  levelDistance: number
  // 距开赛的分钟数（负数按 0 处理）
  startsAtDeltaMinutes: number
  participantCount: number
  // 含发起人的总人数上限
  capacity: number
}

// 权重：水平 .6 + 时间 .25 + 成局度 .15，结果 0..1
const WEIGHTS = { level: 0.6, time: 0.25, fill: 0.15 }
// 水平距离 20（= 2 级）以上视为完全无关
const LEVEL_DISTANCE_SPAN = 20
// 时间衰减跨度：两周内线性衰减到 0
const TIME_SPAN_DAYS = 14

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function recommendScore(input: RecommendInput): number {
  const level = clamp01(1 - input.levelDistance / LEVEL_DISTANCE_SPAN)
  const days = Math.max(0, input.startsAtDeltaMinutes) / 1440
  const time = clamp01(1 - days / TIME_SPAN_DAYS)
  const fill = input.capacity > 0 ? clamp01(input.participantCount / input.capacity) : 0
  const score = WEIGHTS.level * level + WEIGHTS.time * time + WEIGHTS.fill * fill
  return Math.round(score * 10000) / 10000
}