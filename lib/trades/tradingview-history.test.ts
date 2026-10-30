import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { parseTradingViewTradeHistoryCsv as parse } from './tradingview-history'

const fixture = readFileSync(new URL('./fixtures/tradingview-history.csv', import.meta.url), 'utf8')
const header = fixture.split('\n')[0]
const pair = (entry = 'Mar 17, 2026 at 14:33', exit = 'Mar 17, 2026 at 14:50') => `${header}\nTEST:ABC,1,Exit long,"${exit}",exit,exit,102,4,400,8,2,0,8,2\nTEST:ABC,1,Entry long,"${entry}",entry,entry,100,4,400,8,2,0,8,2`

test('pairs six trades independently of row order and preserves source decimals and signs', () => {
  const trades = parse(fixture, 'Europe/Warsaw')
  expect(trades).toHaveLength(6)
  expect(trades[0]).toEqual({ sourceKey: 'tradingview:["TEST:ABC","1","entry1","exit1"]', symbol: 'TEST:ABC', side: 'long', entryPrice: '100.25', exitPrice: '102', openedAt: '2026-03-17T13:33:00.000Z', sourcePnlUsd: '7', quantity: '4' })
  expect(trades.map(trade => [trade.side, trade.sourcePnlUsd])).toEqual([['long', '7'], ['short', '-4'], ['long', '0'], ['short', '12.50'], ['long', '-1'], ['short', '3']])
  expect(parse(`\uFEFF${fixture.replaceAll('\n', '\r\n')}`, 'Europe/Warsaw')).toEqual(trades)
  expect(parse(fixture.split('\n').slice(0, 1).concat(fixture.trim().split('\n').slice(1).reverse()).join('\n'), 'Europe/Warsaw').map(t => t.sourceKey).sort()).toEqual(trades.map(t => t.sourceKey).sort())
})

test.each([
  ['duplicate entry', (csv: string) => `${csv}\n${csv.split('\n')[2]}`, /Row 4.*duplicate/i],
  ['missing entry', (csv: string) => csv.split('\n').slice(0, 2).join('\n'), /Row 2.*entry/i],
  ['mismatched side', (csv: string) => csv.replace('Entry long', 'Entry short'), /Row 3.*side/i],
  ['mismatched quantity', (csv: string) => csv.replace('100,4,', '100,5,'), /Row 3.*quantity/i],
  ['precision-mismatched quantity', (csv: string) => csv.replace('100,4,', '100,4.0000000000000001,'), /Row 3.*quantity/i],
  ['precision-mismatched PnL', (csv: string) => csv.replace('100,4,400,8', '100,4,400,8.0000000000000001'), /Row 3.*P&L/i],
  ['mismatched PnL', (csv: string) => csv.replace('100,4,400,8', '100,4,400,9'), /Row 3.*P&L/i],
  ['duplicate order', (csv: string) => csv.replace(',entry,entry,', ',exit,entry,'), /Row 3.*order/i],
  ['unknown type', (csv: string) => csv.replace('Entry long', 'Buy'), /Row 3.*type/i],
  ['invalid price', (csv: string) => csv.replace('100,4,', 'NaN,4,'), /Row 3.*price/i],
  ['zero price', (csv: string) => csv.replace('100,4,', '0,4,'), /Row 3.*price/i],
  ['negative quantity', (csv: string) => csv.replace('100,4,', '100,-4,'), /Row 3.*quantity/i],
  ['invalid PnL', (csv: string) => csv.replace('100,4,400,8', '100,4,400,Infinity'), /Row 3.*P&L/i],
  ['blank symbol', (csv: string) => csv.replace('TEST:ABC,1,Entry', ',1,Entry'), /Row 3.*symbol/i],
  ['invalid trade number', (csv: string) => csv.replace('TEST:ABC,1,Entry', 'TEST:ABC,0,Entry'), /Row 3.*trade number/i],
  ['missing order', (csv: string) => csv.replace(',entry,entry,', ',,entry,'), /Row 3.*order/i],
  ['invalid date', (csv: string) => csv.replace('Mar 17, 2026 at 14:33', 'Feb 30, 2026 at 14:33'), /Row 3.*date/i],
  ['exit before entry', (csv: string) => csv.replace('14:50', '14:00'), /Row 2.*before/i],
  ['wrong row width', (csv: string) => csv.replace(',8,2\n', ',8\n'), /Row 2.*columns/i],
  ['unclosed quote', (csv: string) => `${csv}\n"broken`, /Row 4.*quoted/i],
])('rejects %s with source row number', (_, change, error) => {
  expect(() => parse(change(pair()), 'UTC')).toThrow(error)
})

test('rejects absent or repeated columns, empty data and bounds', () => {
  expect(() => parse('', 'UTC')).toThrow(/empty/i)
  expect(() => parse(header, 'UTC')).toThrow(/no trade rows/i)
  expect(() => parse(pair().replace('Symbol,', 'Other,'), 'UTC')).toThrow(/columns/i)
  expect(() => parse(pair().replace('Signal,', 'Symbol,'), 'UTC')).toThrow(/duplicate.*column/i)
  expect(() => parse('é'.repeat(1_000_001), 'UTC')).toThrow(/2 MB/i)
  expect(() => parse(`${header}\n${Array(5001).fill(pair().split('\n')[1]).join('\n')}`, 'UTC')).toThrow(/5000/i)
})

test('requires an existing timezone and rejects DST gaps and overlaps', () => {
  expect(() => parse(pair(), 'Mars/Olympus')).toThrow(/timezone/i)
  expect(() => parse(pair('Mar 29, 2026 at 02:30', 'Mar 29, 2026 at 04:00'), 'Europe/Warsaw')).toThrow(/Row 3.*nonexistent/i)
  expect(() => parse(pair('Oct 25, 2026 at 02:30', 'Oct 25, 2026 at 04:00'), 'Europe/Warsaw')).toThrow(/Row 3.*ambiguous/i)
  expect(parse(pair('Oct 25, 2026 at 03:30', 'Oct 25, 2026 at 04:00'), 'Europe/Warsaw')[0].openedAt).toBe('2026-10-25T02:30:00.000Z')
})

test.each([
  ['4', '4.00', '8', '+008.000'],
  ['.5', '0.500', '-8', '-008.000'],
  ['+0004.00', '4', '-0', '+0.000'],
])('accepts equivalent exact source decimals %s/%s and %s/%s', (exitQty, entryQty, exitPnl, entryPnl) => {
  const csv = pair().replace('102,4,400,8', `102,${exitQty},400,${exitPnl}`).replace('100,4,400,8', `100,${entryQty},400,${entryPnl}`)
  expect(parse(csv, 'UTC')[0]).toMatchObject({ quantity: entryQty, sourcePnlUsd: exitPnl })
})
