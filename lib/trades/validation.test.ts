import { expect, test } from 'vitest'
import { validateDraft, validateNote } from './validation'
const draft = { originalNote: '  CL short 87.64\n', symbol: 'CL', side: 'short', entryPrice: '87.64', stopPrice: '87.90', setup: 'ORB', openedAt: '2026-10-19T10:00:00.000Z' }
test('validates confirmed fields without changing the note', () => {
  expect(validateDraft(draft)).toEqual({ value: draft })
})
test.each(['symbol', 'side', 'entryPrice', 'stopPrice', 'setup', 'openedAt', 'originalNote'])('requires %s', (field) => {
  expect(validateDraft({ ...draft, [field]: '' })).toHaveProperty('error')
})
test.each(['87.64', '87.60', '-1', 'Infinity', 'NaN', '0x10'])('rejects an invalid short stop %s', (stopPrice) => {
  expect(validateDraft({ ...draft, stopPrice })).toHaveProperty('error')
})
test('rejects wrong long stop and invalid dates', () => {
  expect(validateDraft({ ...draft, side: 'long' })).toHaveProperty('error')
  expect(validateDraft({ ...draft, openedAt: 'tomorrow' })).toHaveProperty('error')
})
test('bounded notes are preserved exactly', () => {
  expect(validateNote(draft.originalNote)).toBeNull()
  expect(validateNote('a'.repeat(1001))).toBeTruthy()
  expect(validateNote('   ')).toBeTruthy()
})
test('compares decimal stops without floating point rounding', () => {
  expect(validateDraft({ ...draft, entryPrice: '100.000000000000001', stopPrice: '100.000000000000002' })).toHaveProperty('value')
})
test('rejects impossible opening dates', () => {
  expect(validateDraft({ ...draft, openedAt: '2026-02-30T10:00:00Z' })).toHaveProperty('error')
})
