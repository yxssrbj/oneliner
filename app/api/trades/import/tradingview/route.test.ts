import { readFileSync } from 'node:fs'
import { beforeEach, expect, test, vi } from 'vitest'
import { POST } from './route'
import { parseTradingViewTradeHistoryCsv } from '../../../../../lib/trades/tradingview-history'
const auth = vi.hoisted(() => vi.fn())
vi.mock('../../../../../lib/supabase/server', () => ({ getAuthenticatedUser: auth }))
const rpc = vi.fn(), select = vi.fn(), eq = vi.fn(), order = vi.fn(), range = vi.fn()
const query = { select, eq, order, range }
const csv = readFileSync('lib/trades/fixtures/tradingview-history.csv', 'utf8')
const request = (body: unknown) => new Request('http://localhost/api/trades/import/tradingview', { method: 'POST', body: JSON.stringify(body) })
beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ user: { id: 'owner' }, supabase: { rpc, from: () => query } }); rpc.mockResolvedValue({ data: { inserted: 6, alreadyPresent: 0 }, error: null }); for (const fn of [select, eq, order]) fn.mockReturnValue(query); range.mockResolvedValue({ data: parseTradingViewTradeHistoryCsv(csv, 'UTC').map((trade, index) => ({ id: `trade-${index}`, source_key: trade.sourceKey })), error: null }) })
test.each([false, true])('requires auth for commit=%s', async commit => {
  auth.mockResolvedValueOnce(null)
  expect((await POST(request({ csv, timeZone: 'UTC', commit }))).status).toBe(401)
  expect(rpc).not.toHaveBeenCalled()
})
test('previews six resolved trades without a write', async () => {
  const response = await POST(request({ csv, timeZone: 'Europe/Warsaw', commit: false }))
  expect(response.status).toBe(200)
  expect((await response.json()).trades).toEqual(parseTradingViewTradeHistoryCsv(csv, 'Europe/Warsaw'))
  expect(rpc).not.toHaveBeenCalled()
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
})
test('reparses on commit and sends only validated rows to the owner-scoped RPC', async () => {
  const response = await POST(request({ csv, timeZone: 'UTC', commit: true, owner_id: 'victim', trades: [] }))
  expect(await response.json()).toMatchObject({ inserted: 6, alreadyPresent: 0 })
  expect(rpc).toHaveBeenCalledWith('import_trade_history', { rows: parseTradingViewTradeHistoryCsv(csv, 'UTC') })
  rpc.mockResolvedValueOnce({ data: { inserted: 0, alreadyPresent: 6 }, error: null })
  expect(await (await POST(request({ csv, timeZone: 'UTC', commit: true }))).json()).toMatchObject({ inserted: 0, alreadyPresent: 6 })
})
test.each([null, {}, { csv, timeZone: 'UTC' }, { csv, timeZone: 'invalid', commit: true }, { csv: 'x'.repeat(2_000_001), timeZone: 'UTC', commit: true }])('rejects invalid payload without writing', async input => {
  expect((await POST(request(input))).status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
})
test('returns row-specific errors without writes', async () => {
  const response = await POST(request({ csv: csv.replace('Exit long', 'Broken'), timeZone: 'UTC', commit: true }))
  expect(response.status).toBe(400)
  expect((await response.json()).error).toContain('Row 2')
  expect(rpc).not.toHaveBeenCalled()
})
test.each([false, true])('database failure is private and retryable (throw=%s)', async throws => {
  if (throws) rpc.mockRejectedValueOnce(new Error('private detail'))
  else rpc.mockResolvedValueOnce({ data: null, error: { message: 'private detail' } })
  const response = await POST(request({ csv, timeZone: 'UTC', commit: true }))
  expect(response.status).toBe(500)
  expect(await response.text()).not.toContain('private detail')
})
test('commit returns all six saved rows with owner scope and no raw source payload', async () => {
  const response = await POST(request({ csv, timeZone: 'UTC', commit: true }))
  expect((await response.json()).trades).toHaveLength(6)
  expect(eq).toHaveBeenCalledWith('owner_id', 'owner')
  expect(select).toHaveBeenCalledWith(expect.stringContaining('source_key'))
  expect(select.mock.calls[0][0]).not.toContain('source_payload')
})
test('post-commit read failure explicitly says saved and keeps retry possible', async () => {
  range.mockResolvedValueOnce({ data: null, error: { message: 'private detail' } })
  const response = await POST(request({ csv, timeZone: 'UTC', commit: true }))
  expect(response.status).toBe(500)
  expect((await response.json()).error).toContain('Trades were saved')
})
test('saved import details paginate and omit unrelated owner trades', async () => {
  const imported = parseTradingViewTradeHistoryCsv(csv, 'UTC').map((trade, index) => ({ id: `trade-${index}`, source_key: trade.sourceKey }))
  range.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, index) => ({ id: `other-${index}`, source_key: null })), error: null }).mockResolvedValueOnce({ data: imported, error: null })
  const response = await POST(request({ csv, timeZone: 'UTC', commit: true }))
  expect((await response.json()).trades).toEqual(imported)
  expect(range).toHaveBeenCalledWith(1000, 1999)
})
test('rejects oversized HTTP bodies before parsing or writing', async () => {
  const response = await POST(new Request('http://localhost/api/trades/import/tradingview', { method: 'POST', body: 'x'.repeat(12_001_025) }))
  expect(response.status).toBe(400)
  expect((await response.json()).error).toContain('too large')
  expect(rpc).not.toHaveBeenCalled()
})
test('conflicting source trades are actionable and do not return private database details', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'private source data' } })
  const response = await POST(request({ csv, timeZone: 'UTC', commit: true }))
  expect(response.status).toBe(409)
  expect((await response.json()).error).toContain('Check the CSV and timezone')
  expect(range).not.toHaveBeenCalled()
})
