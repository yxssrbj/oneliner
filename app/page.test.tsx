import { expect, test, vi } from 'vitest'
import Home from './page'

const { io, getAuthenticatedUser } = vi.hoisted(() => ({ io: vi.fn(), getAuthenticatedUser: vi.fn() }))
vi.mock('next/cache', () => ({ io }))
vi.mock('../lib/supabase/server', () => ({ getAuthenticatedUser }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`) } }))

test('waits for runtime rendering before checking capture access', async () => {
  let resume!: () => void
  io.mockReturnValue(new Promise<void>(resolve => { resume = resolve }))
  getAuthenticatedUser.mockResolvedValue(null)
  const response = Home().catch(error => error)
  expect(getAuthenticatedUser).not.toHaveBeenCalled()
  resume()
  expect(await response).toEqual(new Error('redirect:/sign-in'))
})
