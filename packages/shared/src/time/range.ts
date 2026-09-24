// 时间窗：固定按 Asia/Shanghai（UTC+8）计算，不使用服务器本地时区 ——
// 「本地对、上线错」最容易发生在 weekend 这种依赖星期的窗口上。
// 做法：把瞬间加上偏移后用 UTC getter 读出「上海挂钟时间」，反之用 Date.UTC 减偏移还原成瞬间。

export const SHANGHAI_OFFSET_MINUTES = 480
export const DEFAULT_WINDOW_DAYS = 30

export type DatePreset = 'today' | 'tomorrow' | 'weekend' | 'week'

export interface TimeWindow {
  from: Date
  to: Date
}

const OFFSET_MS = SHANGHAI_OFFSET_MINUTES * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

interface ShanghaiParts {
  year: number
  month: number
  day: number
  weekday: number
  hour: number
  minute: number
}

export function shanghaiParts(date: Date): ShanghaiParts {
  const shifted = new Date(date.getTime() + OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  }
}

// 上海本地挂钟时间 → 真实瞬间
export function fromShanghai(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - OFFSET_MS)
}

export function startOfShanghaiDay(date: Date): Date {
  const p = shanghaiParts(date)
  return fromShanghai(p.year, p.month, p.day)
}

export function addShanghaiDays(date: Date, days: number): Date {
  const p = shanghaiParts(date)
  return fromShanghai(p.year, p.month, p.day + days)
}

export function shanghaiWeekday(date: Date): number {
  return shanghaiParts(date).weekday
}

// 0=周日 … 6=周六
function weekendWindow(now: Date): TimeWindow {
  const weekday = shanghaiWeekday(now)
  if (weekday === 0) return { from: startOfShanghaiDay(now), to: addShanghaiDays(now, 1) }
  if (weekday === 6) return { from: startOfShanghaiDay(now), to: addShanghaiDays(now, 2) }
  const daysToSaturday = 6 - weekday
  return { from: addShanghaiDays(now, daysToSaturday), to: addShanghaiDays(now, daysToSaturday + 2) }
}

export function resolveDatePreset(preset: DatePreset, now: Date = new Date()): TimeWindow {
  switch (preset) {
    case 'today':
      return { from: startOfShanghaiDay(now), to: addShanghaiDays(now, 1) }
    case 'tomorrow':
      return { from: addShanghaiDays(now, 1), to: addShanghaiDays(now, 2) }
    case 'weekend':
      return weekendWindow(now)
    case 'week':
      return { from: startOfShanghaiDay(now), to: addShanghaiDays(now, 7) }
  }
}

// 默认时间窗：从现在起 30 天，用于把候选集压到可控规模
export function defaultWindow(now: Date = new Date()): TimeWindow {
  return { from: now, to: new Date(now.getTime() + DEFAULT_WINDOW_DAYS * DAY_MS) }
}

// 显式 from/to 优先，缺失则回落到默认窗口；无法解析的入参忽略
export function resolveWindow(
  input: { datePreset?: DatePreset; from?: string | null; to?: string | null },
  now: Date = new Date(),
): TimeWindow {
  if (input.datePreset) {
    const preset = resolveDatePreset(input.datePreset, now)
    return { from: parseInstant(input.from) ?? preset.from, to: parseInstant(input.to) ?? preset.to }
  }
  const fallback = defaultWindow(now)
  return {
    from: parseInstant(input.from) ?? fallback.from,
    to: parseInstant(input.to) ?? fallback.to,
  }
}

export function parseInstant(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function isWithinWindow(instant: string | Date, window: TimeWindow): boolean {
  const at = instant instanceof Date ? instant : parseInstant(instant)
  if (!at) return false
  return at.getTime() >= window.from.getTime() && at.getTime() < window.to.getTime()
}

// 「今天 / 周末」标签由服务端从 startsAt 派生
export function matchDayTags(startsAt: string | Date, now: Date = new Date()): Array<'today' | 'weekend'> {
  const at = startsAt instanceof Date ? startsAt : parseInstant(startsAt)
  if (!at) return []
  const tags: Array<'today' | 'weekend'> = []
  const today = resolveDatePreset('today', now)
  if (isWithinWindow(at, today)) tags.push('today')
  else if (isWithinWindow(at, resolveDatePreset('weekend', now))) tags.push('weekend')
  return tags
}