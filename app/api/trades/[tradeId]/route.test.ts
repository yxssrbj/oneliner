import { beforeEach, expect, test, vi } from 'vitest'
import { PATCH } from './route'
const auth = vi.hoisted(() => vi.fn())
vi.mock('../../../../lib/supabase/server', () => ({ getAuthenticatedUser: auth }))
const eq = vi.fn(), update = vi.fn(), select = vi.fn(), maybeSingle = vi.fn()
const query = { eq, update, select, maybeSingle }
const id = '00000000-0000-4000-8000-000000000001'
const context = { params: Promise.resolve({ tradeId: id }) }
const request = (body: unknown) => new Request(`http://localhost/api/trades/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
const correction = { symbol: 'ES', side: 'long', entryPrice: '10', stopPrice: '9', setup: 'ORB', openedAt: '2026-10-19T10:00:00Z', confirmed: true }
beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of [eq, update, select]) fn.mockReturnValue(query)
  maybeSingle.mockResolvedValue({ data: { id, r_result: '2' }, error: null })
  auth.mockResolvedValue({ user: { id: 'owner' }, supabase: { from: () => query } })
})
test('authentication and owner scope are mandatory for every edit', async () => {
  auth.mockResolvedValueOnce(null)
  expect((await PATCH(request({ exitPrice: '12' }), context)).status).toBe(401)
  expect(update).not.toHaveBeenCalled()
  maybeSingle.mockResolvedValueOnce({ data: null, error: null })
  expect((await PATCH(request({ exitPrice: '12' }), context)).status).toBe(404)
  expect(eq).toHaveBeenCalledWith('owner_id', 'owner')
  expect(eq).toHaveBeenCalledWith('id', id)
})
test.each([{ exitPrice: '0' }, { exitPrice: '-1' }, { exitPrice: 12 }, { exitPrice: '1e3' }, { exitPrice: '12', r_result: '100' }, { ...correction, confirmed: false }, { ...correction, stopPrice: '11' }, { ...correction, originalNote: 'overwrite' }, null])('rejects invalid or unconfirmed updates %j', async body => {
  expect((await PATCH(request(body), context)).status).toBe(400)
  expect(update).not.toHaveBeenCalled()
})
test('returns database R and never writes generated or original fields', async () => {
  const result = await PATCH(request(correction), context)
  expect(result.status).toBe(200)
  expect((await result.json()).trade.r_result).toBe('2')
  expect(update).toHaveBeenCalledWith({ symbol: 'ES', side: 'long', entry_price: '10', stop_price: '9', setup: 'ORB', opened_at: correction.openedAt })
  expect(result.headers.get('Cache-Control')).toContain('no-store')
})
test('database failures keep details private and never claim success', async () => {
  maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'secret' } })
  const response = await PATCH(request({ exitPrice: '12' }), context)
  expect(response.status).toBe(500)
  expect(await response.text()).not.toContain('secret')
})
