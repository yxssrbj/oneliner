import { beforeEach, expect, test, vi } from 'vitest'
import Friends from './page'
import Invite from './invite/[token]/page'

const { io, getAuthenticatedUser } = vi.hoisted(() => ({ io: vi.fn(), getAuthenticatedUser: vi.fn() }))
vi.mock('next/cache', () => ({ io }))
vi.mock('../../lib/supabase/server', () => ({ getAuthenticatedUser }))
beforeEach(() => vi.clearAllMocks())

test.each([
  ['friends', () => Friends({ searchParams: Promise.resolve({}) })],
  ['invite', () => Invite({ params: Promise.resolve({ token: 'invalid' }) })],
])('%s waits for a request before rendering', async (_route, renderPage) => {
  let resume!: () => void
  io.mockReturnValue(new Promise<void>(resolve => { resume = resolve }))
  getAuthenticatedUser.mockResolvedValue(null)
  let settled = false
  const page = renderPage().then(() => { settled = true })
  await Promise.resolve()
  expect(io).toHaveBeenCalledOnce()
  expect(settled).toBe(false)
  expect(getAuthenticatedUser).not.toHaveBeenCalled()
  resume()
  await page
})
