import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LEVEL_OPTIONS,
  LEVEL_TENTHS_MAX,
  LEVEL_TENTHS_MIN,
  LEVEL_TENTHS_STEP,
  formatLevel,
  formatLevelRange,
  formatLevelRangeWithTier,
  isValidLevelTenths,
  levelTier,
  parseLevel,
  snapLevelTenths,
} from '../src/level/ntrp.ts'

test('isValidLevelTenths：只认 10..70 且为 5 的倍数', () => {
  assert.equal(isValidLevelTenths(10), true)
  assert.equal(isValidLevelTenths(35), true)
  assert.equal(isValidLevelTenths(70), true)
  // 越界
  assert.equal(isValidLevelTenths(5), false)
  assert.equal(isValidLevelTenths(75), false)
  // 非 0.5 档位（3.3 级）
  assert.equal(isValidLevelTenths(33), false)
  // 非整数与非数字
  assert.equal(isValidLevelTenths(35.5), false)
  assert.equal(isValidLevelTenths('35'), false)
  assert.equal(isValidLevelTenths(null), false)
  assert.equal(isValidLevelTenths(undefined), false)
  assert.equal(isValidLevelTenths(Number.NaN), false)
})

test('LEVEL_OPTIONS：从 1.0 到 7.0 共 13 档', () => {
  assert.equal(LEVEL_OPTIONS.length, (LEVEL_TENTHS_MAX - LEVEL_TENTHS_MIN) / LEVEL_TENTHS_STEP + 1)
  assert.equal(LEVEL_OPTIONS.length, 13)
  assert.equal(LEVEL_OPTIONS[0], 10)
  assert.equal(LEVEL_OPTIONS.at(-1), 70)
  assert.equal(LEVEL_OPTIONS.every((value) => isValidLevelTenths(value)), true)
})

test('formatLevel：十分位转一位小数，空值退化成「未填写」', () => {
  assert.equal(formatLevel(35), '3.5')
  assert.equal(formatLevel(10), '1.0')
  assert.equal(formatLevel(70), '7.0')
  assert.equal(formatLevel(30), '3.0')
  assert.equal(formatLevel(null), '未填写')
  assert.equal(formatLevel(undefined), '未填写')
  // 脏数据（NaN）也不能抛出，页面会直接渲染这个字符串
  assert.equal(formatLevel(Number.NaN), '未填写')
  assert.equal(formatLevel(Number.POSITIVE_INFINITY), '未填写')
})

test('parseLevel：字符串/数字都能解析，非法输入返回 null', () => {
  assert.equal(parseLevel('3.5'), 35)
  assert.equal(parseLevel(' 4.0 '), 40)
  assert.equal(parseLevel('3.0'), 30)
  assert.equal(parseLevel(3.5), 35)
  assert.equal(parseLevel('7.0'), 70)
  assert.equal(parseLevel('1.0'), 10)

  // 空值
  assert.equal(parseLevel(''), null)
  assert.equal(parseLevel(null), null)
  assert.equal(parseLevel(undefined), null)
  // 非数字
  assert.equal(parseLevel('abc'), null)
  // 越界
  assert.equal(parseLevel('0.5'), null)
  assert.equal(parseLevel('7.5'), null)
  // 非 0.5 档位：3.3 → 33，非法
  assert.equal(parseLevel('3.3'), null)
  // parseLevel 是严格解析，不做吸附：差一点也判非法，需要吸附请显式调 snapLevelTenths
  assert.equal(parseLevel('3.2'), null)
  assert.equal(parseLevel('3.8'), null)
  assert.equal(snapLevelTenths(32), 30)
  assert.equal(snapLevelTenths(38), 40)
})

test('parseLevel 与 formatLevel 互为逆运算', () => {
  for (const tenths of LEVEL_OPTIONS) {
    assert.equal(parseLevel(formatLevel(tenths)), tenths)
  }
})

test('snapLevelTenths：吸附到最近档位并夹在 10..70', () => {
  assert.equal(snapLevelTenths(35), 35)
  // 四舍五入到最近的 5
  assert.equal(snapLevelTenths(33), 35)
  assert.equal(snapLevelTenths(32), 30)
  assert.equal(snapLevelTenths(37), 35)
  // 下限与上限夹取
  assert.equal(snapLevelTenths(0), 10)
  assert.equal(snapLevelTenths(-20), 10)
  assert.equal(snapLevelTenths(100), 70)
  // 结果一定合法
  for (const raw of [-100, 7, 12, 28, 33, 46, 69, 99]) {
    assert.equal(isValidLevelTenths(snapLevelTenths(raw)), true)
  }
})

test('levelTier：分档边界（20 / 30 / 45）', () => {
  assert.equal(levelTier(10), 'BEGINNER')
  assert.equal(levelTier(20), 'BEGINNER')
  assert.equal(levelTier(25), 'CASUAL')
  assert.equal(levelTier(30), 'CASUAL')
  assert.equal(levelTier(35), 'ADVANCED')
  assert.equal(levelTier(45), 'ADVANCED')
  assert.equal(levelTier(50), 'COMPETITIVE')
  assert.equal(levelTier(70), 'COMPETITIVE')
})

test('formatLevelRange / formatLevelRangeWithTier：单值与区间两种形态', () => {
  assert.equal(formatLevelRange(35, 35), '3.5 级')
  assert.equal(formatLevelRange(25, 30), '2.5 - 3.0 级')
  // 档位取区间中点：2.5..3.0 → 中点 27.5 → 四舍五入 28 → 归入 CASUAL
  assert.equal(formatLevelRangeWithTier(25, 30), '休闲 2.5 - 3.0 级')
  assert.equal(formatLevelRangeWithTier(50, 50), '竞赛 5.0 级')
})
