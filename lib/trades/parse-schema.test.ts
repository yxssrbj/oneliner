import { expect, test } from 'vitest'
import { normalizeSuggestion } from './parse-schema'
test('unknown fields remain empty and request clarification', () => {
  const result = normalizeSuggestion({ symbol: 'CL', side: null, entryPrice: null, stopPrice: null, setup: null, clarifications: [] })
  expect(result.side).toBeNull()
  expect(result.stopPrice).toBeNull()
  expect(result.clarifications.join(' ')).toMatch(/direction/i)
  expect(result.clarifications.join(' ')).toMatch(/stop/i)
})
test('malformed output is rejected rather than coerced', () => {
  expect(() => normalizeSuggestion({ symbol: 'CL', side: 'buy', entryPrice: 12 })).toThrow()
})
test('valid suggestions retain explicit prices', () => {
  const value = { symbol: 'CL', side: 'short', entryPrice: '87.64', stopPrice: '87.90', setup: 'ORB', clarifications: [] }
  expect(normalizeSuggestion(value)).toEqual(value)
})
