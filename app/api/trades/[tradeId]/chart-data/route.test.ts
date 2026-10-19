import { beforeEach, expect, test, vi } from 'vitest'
import { GET, PUT } from './route'

const auth = vi.hoisted(() => vi.fn())
vi.mock('../../../../../lib/supabase/server', () => ({ getAuthenticatedUser: auth }))

const eq = vi.fn(), update = vi.fn(), select = vi.fn(), maybeSingle = vi.fn()
const query = { eq, update, select, maybeSingle }
const id = '00000000-0000-4000-8000-000000000001'
const context = { params: Promise.resolve({ tradeId: id }) }
const bars = [{ time: '2026-10-19T09:30:00.000Z', open: 101, high: 104, low: 100, close: 103, volume: 25 }]
const request = (body?: unknown) => new Request(`http://localhost/api/trades/${id}/chart-data`, { method: body === undefined ? 'GET' : 'PUT', ...(body === undefined ? {} : { body: JSON.stringify(body) }) })

beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of [eq, update, select]) fn.mockReturnValue(query)
  maybeSingle.mockResolvedValue({ data: { id, chart_data: bars }, error: null })
  auth.mockResolvedValue({ user: { id: 'owner' }, supabase: { from: () => query } })
})

test('loads only the signed-in owner’s chart data without caching', async () => {
  const response = await GET(request(), context)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ chartData: bars })
  expect(eq).toHaveBeenCalledWith('owner_id', 'owner')
  expect(eq).toHaveBeenCalledWith('id', id)
  expect(response.headers.get('Cache-Control')).toContain('no-store')
})

test('does not serve malformed chart data already stored in the database', async () => {
  maybeSingle.mockResolvedValueOnce({ data: { chart_data: [{ ...bars[0], high: 99 }] }, error: null })
  expect((await GET(request(), context)).status).toBe(500)
})

test('stores valid chart data against the owner’s trade', async () => {
  const response = await PUT(request({ chartData: bars }), context)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ chartData: bars })
  expect(update).toHaveBeenCalledWith({ chart_data: bars })
  expect(eq).toHaveBeenCalledWith('owner_id', 'owner')
  expect(eq).toHaveBeenCalledWith('id', id)
})

test('requires authentication and refuses invalid chart data without writing', async () => {
  auth.mockResolvedValueOnce(null)
  expect((await PUT(request({ chartData: bars }), context)).status).toBe(401)
  expect((await PUT(request({ chartData: [{ ...bars[0], high: 99 }] }), context)).status).toBe(400)
  expect(update).not.toHaveBeenCalled()
})

test('does not reveal database errors or claim data was saved', async () => {
  maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'private detail' } })
  const response = await PUT(request({ chartData: bars }), context)
  expect(response.status).toBe(500)
  expect(await response.text()).not.toContain('private detail')
})
