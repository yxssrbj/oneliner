import { beforeEach, expect, test, vi } from 'vitest'
import { GET, POST } from './route'
const auth = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/supabase/server', () => ({ getAuthenticatedUser: auth }))
const insert = vi.fn(), single = vi.fn(), eq = vi.fn(), select = vi.fn(), order = vi.fn(), is = vi.fn(), gte = vi.fn(), lt = vi.fn()
const range = vi.fn()
const query = { insert, select, eq, single, order, is, gte, lt, range }
const draft = { originalNote: ' CL short 87.64 ', symbol: 'CL', side: 'short', entryPrice: '87.64', stopPrice: '87.90', setup: 'ORB', openedAt: '2026-10-19T10:00:00.000Z' }
const key = '00000000-0000-4000-8000-000000000001'
const request = (body: unknown = draft, id = key) => new Request('http://localhost/api/trades', { method: 'POST', headers: { 'Idempotency-Key': id }, body: JSON.stringify(body) })
beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of [insert, select, eq, is, gte, lt]) fn.mockReturnValue(query)
  order.mockReturnValue(query)
  single.mockResolvedValue({ data: { id: 'trade' }, error: null }); range.mockResolvedValue({ data: [], error: null })
  auth.mockResolvedValue({ user: { id: 'owner' }, supabase: { from: () => query } })
})
test('requires signed-in identity, valid fields and retry key', async () => {
  auth.mockResolvedValueOnce(null)
  expect((await POST(request())).status).toBe(401)
  expect((await POST(request({ ...draft, stopPrice: '80' }))).status).toBe(400)
  expect((await POST(request(draft, ''))).status).toBe(400)
  expect(insert).not.toHaveBeenCalled()
})
test('inserts only explicit confirmed fields under the caller identity', async () => {
  const response = await POST(request({ ...draft, owner_id: 'victim', exit_price: 1 }))
  expect(response.status).toBe(201)
  expect(insert).toHaveBeenCalledWith({ owner_id: 'owner', original_note: draft.originalNote, symbol: 'CL', side: 'short', entry_price: '87.64', stop_price: '87.90', setup: 'ORB', opened_at: draft.openedAt, idempotency_key: key })
  expect(response.headers.get('Cache-Control')).toContain('no-store')
})
test('failed insert never reports saved, safe retry returns original row', async () => {
  single.mockResolvedValueOnce({ data: null, error: { code: 'db_error', message: 'secret' } })
  const failed = await POST(request())
  expect(failed.status).toBe(500)
  expect(await failed.text()).not.toContain('secret')
  single.mockResolvedValueOnce({ data: null, error: { code: '23505' } }).mockResolvedValueOnce({ data: { id: 'existing', original_note: draft.originalNote, symbol: draft.symbol, side: draft.side, entry_price: draft.entryPrice, stop_price: draft.stopPrice, setup: draft.setup, opened_at: draft.openedAt }, error: null })
  const retry = await POST(request())
  expect(retry.status).toBe(200)
  expect((await retry.json()).trade.id).toBe('existing')
  expect(eq).toHaveBeenCalledWith('owner_id', 'owner')
  expect(eq).toHaveBeenCalledWith('idempotency_key', key)
})
test('GET bounds weekly requests and applies owner and inbox filters', async () => {
  expect((await GET(new Request('http://localhost/api/trades?week=bad'))).status).toBe(400)
  const response = await GET(new Request('http://localhost/api/trades?inbox=true&week=2026-10-19'))
  expect(response.status).toBe(200)
  expect(eq).toHaveBeenCalledWith('owner_id', 'owner')
  expect(is).toHaveBeenCalledWith('exit_price', null)
  expect(gte).toHaveBeenCalledWith('opened_at', '2026-10-19T00:00:00.000Z')
  expect(lt).toHaveBeenCalledWith('opened_at', '2026-10-26T00:00:00.000Z')
})
test('does not discard corrected fields if an uncertain prior save already succeeded', async () => {
  single.mockResolvedValueOnce({ data: null, error: { code: '23505' } }).mockResolvedValueOnce({ data: { id: 'existing', original_note: 'other note' }, error: null })
  expect((await POST(request())).status).toBe(409)
})
test('canonical filters return opening-week metrics, with breakeven in denominator', async () => {
  range.mockResolvedValueOnce({ data: [2, -1, 0, null].map(r_result => ({ r_result: r_result === null ? null : String(r_result) })), error: null })
  const result = await GET(new Request('http://localhost/api/trades?weekStart=2026-10-19&status=open'))
  expect((await result.json()).summary).toEqual({ totalR: 1, wins: 1, completedCount: 3, unfinishedCount: 1, winRate: 1 / 3 })
  expect(is).toHaveBeenCalledWith('exit_price', null)
  expect(gte).toHaveBeenCalledWith('opened_at', '2026-10-19T00:00:00.000Z')
  expect(lt).toHaveBeenCalledWith('opened_at', '2026-10-26T00:00:00.000Z')
})
test.each(['weekStart=2026-10-19&week=2026-10-12', 'status=open&inbox=false', 'status=closed', 'weekStart=', 'weekStart=2026-10-18', 'weekStart=2026-02-30'])('rejects ambiguous and invalid filters %s', async params => {
  expect((await GET(new Request(`http://localhost/api/trades?${params}`))).status).toBe(400)
  expect(select).not.toHaveBeenCalled()
})
test('GET rejects missing auth and scopes results to the signed-in owner', async () => {
  auth.mockResolvedValueOnce(null)
  expect((await GET(new Request('http://localhost/api/trades?status=open'))).status).toBe(401)
  await GET(new Request('http://localhost/api/trades?status=open'))
  expect(eq).toHaveBeenCalledWith('owner_id', 'owner')
})

test('weekly metrics include trades beyond the database page size', async () => {
  range.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => ({ r_result: '1' })), error: null }).mockResolvedValueOnce({ data: [{ r_result: '-1' }], error: null })
  const response = await GET(new Request('http://localhost/api/trades?weekStart=2026-10-19'))
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.trades).toHaveLength(1001)
  expect(body.summary.totalR).toBe(999)
  expect(range).toHaveBeenCalledWith(1000, 1999)
})

test('a failed later page never returns partial weekly metrics', async () => {
  range.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => ({ r_result: '1' })), error: null }).mockResolvedValueOnce({ data: null, error: { message: 'secret' } })
  const response = await GET(new Request('http://localhost/api/trades?weekStart=2026-10-19'))
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({ error: 'Could not load trades.' })
})
test('equivalent canonical and legacy aliases remain compatible', async () => {
  expect((await GET(new Request('http://localhost/api/trades?status=open&inbox=true&weekStart=2026-10-19&week=2026-10-19'))).status).toBe(200)
})

const saved = { id: 'existing', original_note: draft.originalNote, symbol: draft.symbol, side: draft.side, entry_price: draft.entryPrice, stop_price: draft.stopPrice, setup: draft.setup, opened_at: draft.openedAt }
test('capture stores a validated exit under the signed-in owner', async () => {
  expect((await POST(request({ ...draft, exitPrice: '86.50', owner_id: 'victim' }))).status).toBe(201)
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ owner_id: 'owner', exit_price: '86.50' }))
  expect((await POST(request({ ...draft, exitPrice: '-1' }))).status).toBe(400)
  expect(insert).toHaveBeenCalledTimes(1)
})
test.each([
  ['86.500', '86.5', 200],
  [null, '', 200],
  ['86.5', undefined, 409],
  [null, '86.5', 409],
  ['86.5', '86.6', 409],
])('retry compares stored exit %s with submitted %s', async (savedExit, exitPrice, status) => {
  single.mockResolvedValueOnce({ data: null, error: { code: '23505' } }).mockResolvedValueOnce({ data: { ...saved, exit_price: savedExit }, error: null })
  expect((await POST(request({ ...draft, exitPrice }))).status).toBe(status)
  expect(eq).toHaveBeenCalledWith('owner_id', 'owner')
  expect(eq).toHaveBeenCalledWith('idempotency_key', key)
})
test('recent reads are private, creation ordered and bounded to three rows', async () => {
  const trades = [{ id: 'new' }, { id: 'middle' }, { id: 'old' }]
  range.mockResolvedValueOnce({ data: trades, error: null })
  const response = await GET(new Request('http://localhost/api/trades?recent=3&owner_id=victim'))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ trades })
  expect(eq).toHaveBeenCalledWith('owner_id', 'owner')
  expect(eq).not.toHaveBeenCalledWith('owner_id', 'victim')
  expect(order.mock.calls).toEqual([['created_at', { ascending: false }], ['id', { ascending: false }]])
  expect(range.mock.calls).toEqual([[0, 2]])
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
})
test.each(['', '0', '1', '4', '-3', '3.0', '03', '3&recent=3'])('rejects invalid or duplicated recent limit %s', async recent => {
  expect((await GET(new Request(`http://localhost/api/trades?recent=${recent}`))).status).toBe(400)
  expect(select).not.toHaveBeenCalled()
})
test('unfiltered reads keep opening order and pagination', async () => {
  await GET(new Request('http://localhost/api/trades'))
  expect(order.mock.calls).toEqual([['opened_at', { ascending: false }], ['id', { ascending: false }]])
  expect(range.mock.calls).toEqual([[0, 999]])
})
test('recent reads reject missing auth and database failures', async () => {
  auth.mockResolvedValueOnce(null)
  expect((await GET(new Request('http://localhost/api/trades?recent=3'))).status).toBe(401)
  expect(select).not.toHaveBeenCalled()
  range.mockRejectedValueOnce(new Error('private database detail'))
  const response = await GET(new Request('http://localhost/api/trades?recent=3'))
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({ error: 'Could not load trades.' })
})
test.each(['week=2026-10-19', 'weekStart=2026-10-19', 'status=open', 'inbox=true', 'inbox=false'])('recent reads reject other filters %s', async filter => {
  const response = await GET(new Request(`http://localhost/api/trades?recent=3&${filter}`))
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ error: 'Recent cannot be combined with other trade filters.' })
  expect(select).not.toHaveBeenCalled()
})
test.each(['exitPrice', 'entryPrice', 'stopPrice'])('retry accepts PostgreSQL leading-zero normalization for %s', async field => {
  const fractionalPrice = `.${'1'.repeat(39)}`
  const submitted = { ...draft, [field]: fractionalPrice }
  if (field === 'stopPrice') submitted.entryPrice = '.01'
  const existing = { ...saved, entry_price: submitted.entryPrice, stop_price: submitted.stopPrice, exit_price: null, [field === 'exitPrice' ? 'exit_price' : field === 'entryPrice' ? 'entry_price' : 'stop_price']: `0${fractionalPrice}` }
  single.mockResolvedValueOnce({ data: null, error: { code: '23505' } }).mockResolvedValueOnce({ data: existing, error: null })
  expect((await POST(request(submitted))).status).toBe(200)
})
