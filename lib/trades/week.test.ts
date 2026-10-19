import { expect, test } from 'vitest'
import { nextWeekStartUtc, weekStartUtc } from './week'
test('UTC Sunday and Monday belong to different opening weeks', () => {
  expect(weekStartUtc(new Date('2026-10-18T23:59:59Z'))).toBe('2026-10-12')
  expect(weekStartUtc(new Date('2026-10-19T00:00:00Z'))).toBe('2026-10-19')
  expect(nextWeekStartUtc('2026-12-28')).toBe('2027-01-04')
})
test('late completion keeps the opening week', () => {
  const trade = { opened_at: '2026-10-18T23:59:59Z', updated_at: '2026-10-20T12:00:00Z' }
  expect(weekStartUtc(new Date(trade.opened_at))).toBe('2026-10-12')
})
