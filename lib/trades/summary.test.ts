import { expect, test } from 'vitest'
import { summarizeTrades } from './summary'
test('breakeven counts as completed while missing outcomes do not', () => {
  expect(summarizeTrades([2, -1, 0, null].map(r_result => ({ r_result, exit_price: r_result === null ? null : "12" })))).toEqual({ totalR: 1, wins: 1, completedCount: 3, unfinishedCount: 1, winRate: 1 / 3, missingRCount: 0 })
})
test('empty weeks have unavailable win rate', () => {
  expect(summarizeTrades([])).toEqual({ totalR: null, wins: 0, completedCount: 0, unfinishedCount: 0, winRate: null, missingRCount: 0 })
  expect(summarizeTrades([{ r_result: null, exit_price: null }]).winRate).toBeNull()
})
test('closed imports count source outcomes while R coverage remains explicit', () => {
  expect(summarizeTrades([
    { r_result: null, exit_price: '12', source_net_pnl_usd: '4' },
    { r_result: null, exit_price: '12', source_net_pnl_usd: '-2' },
    { r_result: null, exit_price: '12', source_net_pnl_usd: '0' },
    { r_result: 2, exit_price: '12', source_net_pnl_usd: '-1' },
    { r_result: null, exit_price: null },
  ])).toEqual({ totalR: 2, wins: 1, completedCount: 4, unfinishedCount: 1, winRate: 0.25, missingRCount: 3 })
  expect(summarizeTrades([{ r_result: null, exit_price: '12', source_net_pnl_usd: '4' }]).totalR).toBeNull()
})
