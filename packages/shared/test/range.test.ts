import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addShanghaiDays,
  fromShanghai,
  isWithinWindow,
  matchDayTags,
  resolveDatePreset,
  resolveWindow,
  shanghaiParts,
  shanghaiWeekday,
  startOfShanghaiDay,
} from '../src/time/range.ts'

// 2026-03-06 是周五；07:00Z = 上海 15:00
const FRIDAY = new Date('2026-03-06T07:00:00.000Z')
// 上海周六 00:30
const SATURDAY = new Date('2026-03-06T16:30:00.000Z')
// 上海周日 01:00（注意此瞬间的 UTC 日期还是周六）
const SUNDAY = new Date('2026-03-07T17:00:00.000Z')

test('固定 Asia/Shanghai：时刻换算不受服务器本地时区影响', () => {
  assert.equal(shanghaiWeekday(FRIDAY), 5)
  assert.equal(shanghaiWeekday(SATURDAY), 6)
  assert.equal(shanghaiWeekday(SUNDAY), 0)
  assert.deepEqual(shanghaiParts(SUNDAY), {
    year: 2026,
    month: 2,
    day: 8,
    weekday: 0,
    hour: 1,
    minute: 0,
  })
  // 上海 2026-03-07 00:00 == 2026-03-06T16:00Z
  assert.equal(fromShanghai(2026, 2, 7).toISOString(), '2026-03-06T16:00:00.000Z')
  assert.equal(startOfShanghaiDay(FRIDAY).toISOString(), '2026-03-05T16:00:00.000Z')
  assert.equal(addShanghaiDays(FRIDAY, 2).toISOString(), '2026-03-07T16:00:00.000Z')
})

test('today / tomorrow：按上海日历天切分', () => {
  const today = resolveDatePreset('today', FRIDAY)
  assert.equal(today.from.toISOString(), '2026-03-05T16:00:00.000Z')
  assert.equal(today.to.toISOString(), '2026-03-06T16:00:00.000Z')

  const tomorrow = resolveDatePreset('tomorrow', FRIDAY)
  assert.equal(tomorrow.from.toISOString(), '2026-03-06T16:00:00.000Z')
  assert.equal(tomorrow.to.toISOString(), '2026-03-07T16:00:00.000Z')
})

test('weekend：周五 / 周六 / 周日三种边界都指向当前这个周末', () => {
  const saturdayStart = '2026-03-06T16:00:00.000Z' // 上海周六 00:00
  const mondayStart = '2026-03-08T16:00:00.000Z' // 上海周一 00:00

  // 周五 15:00 与周六 00:30：本周末 = 周六 + 周日
  for (const now of [FRIDAY, SATURDAY]) {
    const weekend = resolveDatePreset('weekend', now)
    assert.equal(weekend.from.toISOString(), saturdayStart, `now=${now.toISOString()} 的起始时间`)
    assert.equal(weekend.to.toISOString(), mondayStart, `now=${now.toISOString()} 的结束时间`)
  }

  // 周日 01:00 / 23:00：周六已过去，本周末 = 只剩今天，窗口收窄到周一零点
  for (const now of [SUNDAY, fromShanghai(2026, 2, 8, 23)]) {
    const weekend = resolveDatePreset('weekend', now)
    assert.equal(weekend.from.toISOString(), '2026-03-07T16:00:00.000Z', `now=${now.toISOString()} 的起始时间`)
    assert.equal(weekend.to.toISOString(), mondayStart, `now=${now.toISOString()} 的结束时间`)
  }

  // 周一 00:00 起算下个周末
  const monday = fromShanghai(2026, 2, 9, 0)
  assert.equal(resolveDatePreset('weekend', monday).from.toISOString(), '2026-03-13T16:00:00.000Z')
})

test('week：从今天零点起 7 天', () => {
  const week = resolveDatePreset('week', FRIDAY)
  assert.equal(week.from.toISOString(), '2026-03-05T16:00:00.000Z')
  assert.equal(week.to.toISOString(), '2026-03-12T16:00:00.000Z')
})

test('resolveWindow：显式 from/to 优先，否则回落默认 30 天窗口', () => {
  const fallback = resolveWindow({}, FRIDAY)
  assert.equal(fallback.from.toISOString(), FRIDAY.toISOString())
  assert.equal(fallback.to.toISOString(), '2026-04-05T07:00:00.000Z')

  const preset = resolveWindow({ datePreset: 'weekend' }, FRIDAY)
  assert.equal(preset.from.toISOString(), '2026-03-06T16:00:00.000Z')

  // 显式 from 覆盖 preset 起点，非法值被忽略
  const explicit = resolveWindow({ datePreset: 'weekend', from: '2026-03-07T02:00:00.000Z', to: 'not-a-date' }, FRIDAY)
  assert.equal(explicit.from.toISOString(), '2026-03-07T02:00:00.000Z')
  assert.equal(explicit.to.toISOString(), '2026-03-08T16:00:00.000Z')
})

test('isWithinWindow / matchDayTags 边界：左闭右开', () => {
  const today = resolveDatePreset('today', FRIDAY)
  assert.equal(isWithinWindow('2026-03-05T16:00:00.000Z', today), true)
  assert.equal(isWithinWindow('2026-03-06T16:00:00.000Z', today), false)
  assert.equal(isWithinWindow('2026-03-07T10:00:00.000Z', today), false)

  assert.deepEqual(matchDayTags('2026-03-06T11:00:00.000Z', FRIDAY), ['today'])
  assert.deepEqual(matchDayTags('2026-03-07T11:00:00.000Z', FRIDAY), ['weekend'])
  assert.deepEqual(matchDayTags('2026-03-10T11:00:00.000Z', FRIDAY), [])
  // 今天且是周六：只标 today，避免双标签
  assert.deepEqual(matchDayTags('2026-03-07T11:00:00.000Z', SATURDAY), ['today'])
})