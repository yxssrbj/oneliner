import { expect, test } from 'vitest'
import { parseTradingViewChartCsv, validateChartBars } from './chart-csv'

test('parses TradingView OHLC rows while ignoring indicator columns', () => {
  const csv = '\uFEFF"time","Open","High","Low","Close","Volume","RSI"\r\n2026-10-19T09:31:00Z,101,104,100,103,25,62\r\n2026-10-19T09:30:00Z,99,102,98,101,20,55\r\n'

  expect(parseTradingViewChartCsv(csv)).toEqual([
    { time: '2026-10-19T09:30:00.000Z', open: 99, high: 102, low: 98, close: 101, volume: 20 },
    { time: '2026-10-19T09:31:00.000Z', open: 101, high: 104, low: 100, close: 103, volume: 25 },
  ])
})

test('rejects missing required OHLC columns', () => {
  expect(() => parseTradingViewChartCsv('time,open,close\n2026-10-19T09:30:00Z,1,2'))
    .toThrow('CSV must include time, open, high, low, and close columns.')
})

test('rejects invalid prices instead of silently dropping malformed rows', () => {
  expect(() => parseTradingViewChartCsv('time,open,high,low,close\n2026-10-19T09:30:00Z,101,99,98,100'))
    .toThrow('Row 2 has invalid OHLC prices.')
})

test('rejects CSVs with more than 5000 bars', () => {
  const rows = Array.from({ length: 5001 }, (_, index) => `2026-10-19T09:${String(index % 60).padStart(2, '0')}:00Z,1,2,0,1`).join('\n')
  expect(() => parseTradingViewChartCsv(`time,open,high,low,close\n${rows}`))
    .toThrow('CSV can contain at most 5000 chart rows.')
})

test('keeps volume optional when the chart export omits it', () => {
  expect(parseTradingViewChartCsv('time,open,high,low,close\n2026-10-19T09:30:00Z,1,2,0,1'))
    .toEqual([{ time: '2026-10-19T09:30:00.000Z', open: 1, high: 2, low: 0, close: 1, volume: null }])
})

test('rejects ambiguous timestamps and malformed quoted cells', () => {
  expect(() => parseTradingViewChartCsv('time,open,high,low,close\n2026-10-19T09:30:00,1,2,0,1'))
    .toThrow('Row 2 has an invalid timestamp or missing timezone.')
  expect(() => parseTradingViewChartCsv('time,open,high,low,close\n"2026-10-19T09:30:00Z,1,2,0,1'))
    .toThrow('CSV contains an unclosed quoted value.')
})

test('validates chart bars again at the API boundary', () => {
  const bars = [{ time: '2026-10-19T09:30:00.000Z', open: 101, high: 104, low: 100, close: 103, volume: 25 }]
  expect(validateChartBars(bars)).toEqual(bars)
  expect(validateChartBars([{ ...bars[0], high: 99 }])).toBeNull()
  expect(validateChartBars([{ ...bars[0], time: 'not a timestamp' }])).toBeNull()
  expect(validateChartBars([])).toBeNull()
})
