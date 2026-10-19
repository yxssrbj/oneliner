import { expect, test } from 'vitest'
import { summarizeTrades } from './summary'
test('breakeven counts as completed while missing outcomes do not', () => {
  expect(summarizeTrades([2, -1, 0, null].map(r_result => ({ r_result })))).toEqual({ totalR: 1, wins: 1, completedCount: 3, unfinishedCount: 1, winRate: 1 / 3 })
})
test('empty weeks have unavailable win rate', () => {
  expect(summarizeTrades([])).toEqual({ totalR: 0, wins: 0, completedCount: 0, unfinishedCount: 0, winRate: null })
  expect(summarizeTrades([{ r_result: null }]).winRate).toBeNull()
})
