import { beforeEach, expect, test, vi } from 'vitest'
import { GET, PUT } from './route'

const { getAuthenticatedUser } = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn() }))
vi.mock('../../../lib/supabase/server', () => ({ getAuthenticatedUser }))

beforeEach(() => vi.clearAllMocks())

test('rejects unauthenticated profile reads and writes', async () => {
  getAuthenticatedUser.mockResolvedValue(null)
  expect((await GET()).status).toBe(401)
  expect((await PUT(new Request('http://localhost/api/profile', { method: 'PUT', body: JSON.stringify({ displayName: 'Trader' }) }))).status).toBe(401)
})

test('reads only the authenticated caller profile', async () => {
  const single = vi.fn().mockResolvedValue({ data: { display_name: 'Trader' }, error: null })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  getAuthenticatedUser.mockResolvedValue({ user: { id: 'caller-id' }, supabase: { from } })
  const response = await GET()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ displayName: 'Trader' })
  expect(from).toHaveBeenCalledWith('profiles')
  expect(select).toHaveBeenCalledWith('display_name')
  expect(eq).toHaveBeenCalledWith('id', 'caller-id')
})

test('returns an absent profile safely for a newly signed-in user', async () => {
  const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
  getAuthenticatedUser.mockResolvedValue({ user: { id: 'caller-id' }, supabase: { from: () => ({ select: () => ({ eq: () => ({ single }) }) }) } })
  const response = await GET()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ displayName: null })
})

test('rejects blank names and saves only the authenticated caller identity', async () => {
  const single = vi.fn().mockResolvedValue({ data: { display_name: 'Yas' }, error: null })
  const select = vi.fn().mockReturnValue({ single })
  const upsert = vi.fn().mockReturnValue({ select })
  getAuthenticatedUser.mockResolvedValue({ user: { id: 'caller-id' }, supabase: { from: () => ({ upsert }) } })
  const invalid = await PUT(new Request('http://localhost/api/profile', { method: 'PUT', body: JSON.stringify({ displayName: ' \t ' }) }))
  expect(invalid.status).toBe(400)
  const valid = await PUT(new Request('http://localhost/api/profile', { method: 'PUT', body: JSON.stringify({ displayName: ' Yas ', id: 'someone-else' }) }))
  expect(valid.status).toBe(200)
  expect(upsert).toHaveBeenCalledWith({ id: 'caller-id', display_name: 'Yas' }, { onConflict: 'id' })
})
