import { expect, test } from 'vitest'
import { buildWeeklyReview, type ReviewTrade } from './review'

const row = (id: string, opened_at: string, setup: string, r_result: string | null): ReviewTrade => ({ id, opened_at, setup, r_result, exit_price: r_result === null ? null : '10' })

test('all weekly sections reconcile wins losses breakeven and unfinished trades', () => {
  const model = buildWeeklyReview([
    row('b', '2026-10-19T12:00:00Z', 'ORB', '-1'),
    row('a', '2026-10-19T09:00:00Z', 'ORB', '2.5'),
    row('c', '2026-10-20T10:00:00Z', 'VWAP', '0'),
    row('d', '2026-10-20T11:00:00Z', 'VWAP', null),
  ], '2026-10-19')
  expect(model.metrics).toEqual({ totalR: 1.5, averageR: 0.5, bestR: 2.5, winRate: 1 / 3, wins: 1, completedCount: 3, unfinishedCount: 1 })
  expect(model.points.map(point => point.totalR)).toEqual([0, 2.5, 1.5, 1.5])
  expect(model.setups).toEqual([{ name: 'ORB', totalR: 1.5, completedCount: 2, unfinishedCount: 0, wins: 1 }, { name: 'VWAP', totalR: 0, completedCount: 1, unfinishedCount: 1, wins: 0 }])
  expect(model.days.slice(0, 2).map(day => [day.totalR, day.completedCount, day.unfinishedCount])).toEqual([[1.5, 2, 0], [0, 1, 1]])
})

test('chart order is deterministic and empty or all unfinished weeks have no performance', () => {
  const week = '2026-10-19'
  const equal = buildWeeklyReview([row('b', '2026-10-19T10:00:00Z', 'ORB', '0.1'), row('a', '2026-10-19T10:00:00Z', 'ORB', '0.2')], week)
  expect(equal.points.map(point => point.tradeId)).toEqual([null, 'a', 'b'])
  expect(equal.metrics.totalR).toBeCloseTo(0.3)
  const offsets = buildWeeklyReview([row('later', '2026-10-19T09:30:00Z', 'ORB', '1'), row('earlier', '2026-10-19T10:00:00+01:00', 'ORB', '1')], week)
  expect(offsets.points.map(point => point.tradeId)).toEqual([null, 'earlier', 'later'])
  for (const trades of [[], [row('open', '2026-10-19T10:00:00Z', 'ORB', null)]]) {
    const model = buildWeeklyReview(trades, week)
    expect(model.metrics.totalR).toBeNull()
    expect(model.metrics.averageR).toBeNull()
    expect(model.metrics.bestR).toBeNull()
    expect(model.metrics.winRate).toBeNull()
    expect(model.points).toEqual([])
  }
})

test('UTC Monday boundaries place trades in the correct days', () => {
  const model = buildWeeklyReview([row('start', '2026-10-19T00:00:00.000Z', 'ORB', '1'), row('end', '2026-10-25T23:59:59.999Z', 'ORB', '-1'), row('outside', '2026-10-26T00:00:00.000Z', 'ORB', '10')], '2026-10-19')
  expect(model.trades.map(trade => trade.id)).toEqual(['start', 'end'])
  expect(model.days[0].completedCount).toBe(1)
  expect(model.days[6].completedCount).toBe(1)
  expect(model.metrics.totalR).toBe(0)
})

test('daily results use UTC dates when timestamp offsets cross midnight', () => {
  const model = buildWeeklyReview([
    row('monday', '2026-10-20T00:30:00+02:00', 'ORB', '1.5'),
    row('tuesday', '2026-10-19T23:30:00-02:00', 'ORB', null),
  ], '2026-10-19')

  expect(model.days.slice(0, 2).map(day => [day.date, day.totalR, day.completedCount, day.unfinishedCount])).toEqual([
    ['2026-10-19', 1.5, 1, 0],
    ['2026-10-20', 0, 0, 1],
  ])
})
