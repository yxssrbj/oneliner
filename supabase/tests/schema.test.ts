import { existsSync, readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const migrationUrl = new URL('../migrations/202610180001_core.sql', import.meta.url)
const chartDataMigrationUrl = new URL('../migrations/202610190001_trade_chart_data.sql', import.meta.url)

test('chart data is stored as a validated private trade field', () => {
  expect(existsSync(chartDataMigrationUrl)).toBe(true)
  if (!existsSync(chartDataMigrationUrl)) return
  const migration = readFileSync(chartDataMigrationUrl, 'utf8')
  expect(migration).toMatch(/alter table public\.trades\s+add column chart_data jsonb/i)
  expect(migration).toMatch(/jsonb_typeof\(chart_data\)\s*=\s*'array'/i)
})

test('core migration exists', () => {
  expect(existsSync(migrationUrl)).toBe(true)
})

test('migration defines owner-only trade access and immutable ownership', () => {
  if (!existsSync(migrationUrl)) return
  const migration = readFileSync(migrationUrl, 'utf8')
  expect(migration).toMatch(/create table public\.trades/i)
  expect(migration).toMatch(/enable row level security/i)
  expect(migration).toMatch(/auth\.uid\(\)\s*=\s*owner_id/i)
  expect(migration).toMatch(/old\.owner_id\s+is distinct from new\.owner_id/i)
})

test('migration derives R from entry, stop, and exit', () => {
  if (!existsSync(migrationUrl)) return
  const migration = readFileSync(migrationUrl, 'utf8')
  expect(migration).toMatch(/generated always as/i)
  expect(migration).toMatch(/exit_price\s*-\s*entry_price/i)
  expect(migration).toMatch(/entry_price\s*-\s*exit_price/i)
})

test('nonblank checks cover form feed and vertical tab', () => {
  const migration = readFileSync(migrationUrl, 'utf8')
  for (const field of ['display_name', 'original_note', 'symbol', 'setup']) {
    expect(migration).toContain(`btrim(${field}, E' \\t\\n\\r\\f' || chr(11))`)
  }
  expect(migration).not.toContain('\\v')
})
