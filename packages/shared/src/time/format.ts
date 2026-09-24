// 时间展示与输入：全部按 Asia/Shanghai 挂钟时间处理。
// 关键点 —— 展示不能用 Date 的本地 getter：用户设备时区不是 +08:00 时，
// 「19:00 开赛」会被显示成别的时刻；反过来 datetime-local 输入的值也必须
// 按 +08:00 解释，否则跨时区访问就整体偏移。

import { fromShanghai, shanghaiParts } from './range'

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function toDate(value: string | Date): Date | null {
  const at = value instanceof Date ? value : new Date(value)
  return Number.isNaN(at.getTime()) ? null : at
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function sameDay(a: ReturnType<typeof shanghaiParts>, b: ReturnType<typeof shanghaiParts>): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

function durationText(minutes: number): string {
  const hours = minutes / 60
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

export interface MatchTimeLabel {
  // 卡片右上主行："今天 19:00" / "周六 09:00"
  primary: string
  // 卡片右上次行："周三 · 约 2 小时" / "9月27日 · 约 2 小时"
  secondary: string
}

export function matchTimeLabel(
  startsAt: string | Date,
  durationMinutes: number,
  now: Date = new Date(),
): MatchTimeLabel {
  const at = toDate(startsAt)
  if (!at) return { primary: '时间待定', secondary: `约 ${durationText(durationMinutes)} 小时` }

  const parts = shanghaiParts(at)
  const today = shanghaiParts(now)
  const tomorrow = shanghaiParts(new Date(now.getTime() + 24 * 60 * 60 * 1000))
  const clock = `${pad(parts.hour)}:${pad(parts.minute)}`
  const weekday = WEEKDAY_LABELS[parts.weekday]
  const duration = `约 ${durationText(durationMinutes)} 小时`

  if (sameDay(parts, today)) return { primary: `今天 ${clock}`, secondary: `${weekday} · ${duration}` }
  if (sameDay(parts, tomorrow)) return { primary: `明天 ${clock}`, secondary: `${weekday} · ${duration}` }
  return {
    primary: `${weekday} ${clock}`,
    secondary: `${parts.month + 1}月${parts.day}日 · ${duration}`,
  }
}

// 详情页：完整日期时间，例 "2026年9月27日 周六 09:00"
export function formatFullTime(startsAt: string | Date): string {
  const at = toDate(startsAt)
  if (!at) return '时间待定'
  const p = shanghaiParts(at)
  return `${p.year}年${p.month + 1}月${p.day}日 ${WEEKDAY_LABELS[p.weekday]} ${pad(p.hour)}:${pad(p.minute)}`
}

// 会话列表与消息气泡：今天显示时刻，昨天显示「昨天」，更早显示日期
export function formatChatTime(at: string | Date, now: Date = new Date()): string {
  const date = toDate(at)
  if (!date) return ''
  const parts = shanghaiParts(date)
  if (sameDay(parts, shanghaiParts(now))) return `${pad(parts.hour)}:${pad(parts.minute)}`
  if (sameDay(parts, shanghaiParts(new Date(now.getTime() - 24 * 60 * 60 * 1000)))) return '昨天'
  return `${parts.month + 1}月${parts.day}日`
}

// "2026-09-27T09:00" → ISO 瞬间（按 +08:00 解释，而不是设备本地时区）
export function shanghaiInputToInstant(value: string): string | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim())
  if (!matched) return null
  const [, y, m, d, h, mi] = matched
  return fromShanghai(Number(y), Number(m) - 1, Number(d), Number(h), Number(mi)).toISOString()
}

// ISO 瞬间 → "2026-09-27T09:00"（datetime-local 的 value 格式）
export function instantToShanghaiInput(instant: string | Date): string {
  const at = toDate(instant)
  if (!at) return ''
  const p = shanghaiParts(at)
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}