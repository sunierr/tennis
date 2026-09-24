import { test } from 'node:test'
import assert from 'node:assert/strict'
import { levelDistance, levelDirection, levelFit, levelFitText, recommendScore } from '../src/level/fit.ts'

test('levelDistance：区间内为 0，区间外取差值', () => {
  assert.equal(levelDistance(35, 30, 40), 0)
  assert.equal(levelDistance(30, 30, 40), 0)
  assert.equal(levelDistance(40, 30, 40), 0)
  assert.equal(levelDistance(25, 30, 40), 5)
  assert.equal(levelDistance(50, 30, 40), 10)
  // 单值区间（min === max）
  assert.equal(levelDistance(35, 35, 35), 0)
  assert.equal(levelDistance(30, 35, 35), 5)
})

test('levelFit：默认容差 ±0.5 级（±5）', () => {
  assert.equal(levelFit(35, 30, 40), 'IN_RANGE')
  assert.equal(levelFit(25, 30, 40), 'NEAR') // 恰好等于容差边界
  assert.equal(levelFit(45, 30, 40), 'NEAR')
  assert.equal(levelFit(20, 30, 40), 'FAR') // 超出 1 级
  assert.equal(levelFit(50, 30, 40), 'FAR')
  // 容差可覆盖：3.5 级用户看 2.0 级局，±1 级下仍是 NEAR
  assert.equal(levelFit(35, 20, 20, 15), 'NEAR')
  assert.equal(levelFit(35, 20, 20, 10), 'FAR')
})

test('levelDirection 与三态文案', () => {
  assert.equal(levelDirection(25, 30, 40), 'HIGHER')
  assert.equal(levelDirection(50, 30, 40), 'LOWER')
  assert.equal(levelDirection(35, 30, 40), 'SAME')

  assert.equal(levelFitText('IN_RANGE', 'SAME'), '水平合适')
  assert.equal(levelFitText('NEAR', 'HIGHER'), '略高一点')
  assert.equal(levelFitText('NEAR', 'LOWER'), '略低一点')
  assert.equal(levelFitText('FAR', 'HIGHER'), '差得多')
})

test('recommendScore：权重 0.6/0.25/0.15，越契合越高', () => {
  const base = { startsAtDeltaMinutes: 0, participantCount: 0, capacity: 4 }
  // 完全契合 + 立即开赛 + 未成局 = 0.6 * 1 + 0.25 * 1 + 0.15 * 0 = 0.85
  assert.equal(recommendScore({ ...base, levelDistance: 0 }), 0.85)
  // 已满员 + 完全契合 + 立即开赛 = 1
  assert.equal(recommendScore({ ...base, levelDistance: 0, participantCount: 4 }), 1)
  // 水平差 20（= 2 级）时水平分归零
  assert.equal(recommendScore({ ...base, levelDistance: 20 }), 0.25)
  assert.equal(recommendScore({ ...base, levelDistance: 100 }), 0.25)

  const inRange = recommendScore({ levelDistance: 0, startsAtDeltaMinutes: 120, participantCount: 1, capacity: 4 })
  const farAway = recommendScore({ levelDistance: 10, startsAtDeltaMinutes: 3000, participantCount: 1, capacity: 4 })
  assert.ok(inRange > farAway, `${inRange} 应高于 ${farAway}`)

  // 时间越近分越高
  const soon = recommendScore({ levelDistance: 0, startsAtDeltaMinutes: 60, participantCount: 2, capacity: 4 })
  const later = recommendScore({ levelDistance: 0, startsAtDeltaMinutes: 60 * 24 * 10, participantCount: 2, capacity: 4 })
  assert.ok(soon > later)

  // 已开赛（负数）不产生额外加分
  assert.equal(
    recommendScore({ levelDistance: 0, startsAtDeltaMinutes: -500, participantCount: 2, capacity: 4 }),
    recommendScore({ levelDistance: 0, startsAtDeltaMinutes: 0, participantCount: 2, capacity: 4 }),
  )
  // 异常入参不产生 NaN
  assert.equal(recommendScore({ levelDistance: 0, startsAtDeltaMinutes: 0, participantCount: 0, capacity: 0 }), 0.85)
})