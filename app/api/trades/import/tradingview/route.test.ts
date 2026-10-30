import { readFileSync } from 'node:fs'
import { beforeEach, expect, test, vi } from 'vitest'
import { POST } from './route'
import { parseTradingViewTradeHistoryCsv } from '../../../../../lib/trades/tradingview-history'
const auth = vi.hoisted(() => vi.fn())
vi.mock('../../../../../lib/supabase/server', () => ({ getAuthenticatedUser: auth }))
const rpc = vi.fn()
const csv = readFileSync('lib/trades/fixtures/tradingview-history.csv', 'utf8')
const request = (body: unknown) => new Request('http://localhost/api/trades/import/tradingview', { method: 'POST', body: JSON.stringify(body) })
beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ user: { id: 'owner' }, supabase: { rpc } }); rpc.mockResolvedValue({ data: { inserted: 6, alreadyPresent: 0 }, error: null }) })
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
  expect(await response.json()).toEqual({ inserted: 6, alreadyPresent: 0 })
  expect(rpc).toHaveBeenCalledWith('import_trade_history', { rows: parseTradingViewTradeHistoryCsv(csv, 'UTC') })
  rpc.mockResolvedValueOnce({ data: { inserted: 0, alreadyPresent: 6 }, error: null })
  expect(await (await POST(request({ csv, timeZone: 'UTC', commit: true }))).json()).toEqual({ inserted: 0, alreadyPresent: 6 })
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
