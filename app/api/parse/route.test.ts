import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { POST } from './route'
const auth = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/supabase/server', () => ({ getAuthenticatedUser: auth }))
const fetchMock = vi.fn()
const suggestion = { symbol: 'CL', side: 'short', entryPrice: '87.64', stopPrice: null, setup: 'ORB', clarifications: [] }
const request = (note = 'CL short 87.64 ORB') => new Request('http://localhost/api/parse', { method: 'POST', body: JSON.stringify({ note }) })
beforeEach(() => { vi.stubEnv('OPENAI_API_KEY', 'secret'); vi.stubGlobal('fetch', fetchMock); auth.mockResolvedValue({ user: { id: 'owner' }, supabase: { from: vi.fn(() => { throw new Error('must not write') }) } }); fetchMock.mockReset() })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
test('requires auth and bounds input before contacting AI', async () => {
  auth.mockResolvedValueOnce(null)
  expect((await POST(request())).status).toBe(401)
  expect((await POST(request('a'.repeat(1001)))).status).toBe(400)
  expect(fetchMock).not.toHaveBeenCalled()
})
test('extracts nullable suggestions without writing a trade', async () => {
  fetchMock.mockResolvedValue(Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(suggestion) }] }] }))
  const response = await POST(request())
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.suggestion.stopPrice).toBeNull()
  expect(body.suggestion.clarifications.join(' ')).toMatch(/stop/)
  const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(payload.text.format.type).toBe('json_schema')
  expect(payload.store).toBe(false)
})
test.each([
  { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] },
  { status: 'incomplete', output: [] },
  { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{}' }] }] },
])('safe recoverable error for refusal or malformed output', async (output) => {
  fetchMock.mockResolvedValue(Response.json(output))
  const response = await POST(request())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain('secret')
})
test('missing key or timeout leaves manual entry available', async () => {
  vi.stubEnv('OPENAI_API_KEY', '')
  expect((await POST(request())).status).toBe(503)
  vi.stubEnv('OPENAI_API_KEY', 'secret')
  fetchMock.mockRejectedValue(new Error('timeout secret'))
  const response = await POST(request())
  expect(response.status).toBe(503)
  expect(await response.text()).toContain('manually')
})
