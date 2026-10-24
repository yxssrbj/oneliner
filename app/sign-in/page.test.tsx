import { beforeEach, expect, test, vi } from 'vitest'
import SignIn from './page'

const {io, getAuthenticatedUser} = vi.hoisted(() => ({io: vi.fn(), getAuthenticatedUser: vi.fn()}))
vi.mock('next/cache', () => ({io}))
vi.mock('../../lib/supabase/server', () => ({getAuthenticatedUser}))
vi.mock('next/navigation', () => ({redirect: (url: string) => {throw new Error(`redirect:${url}`)}}))
beforeEach(() => {vi.clearAllMocks(); getAuthenticatedUser.mockResolvedValue(null)})

test('sign-in waits for runtime before Supabase initializes its clock-dependent session', async () => {
  let resume!: () => void
  io.mockReturnValue(new Promise<void>(resolve => {resume = resolve}))
  const response = SignIn({searchParams: Promise.resolve({})})
  await Promise.resolve()
  await Promise.resolve()
  expect(io).toHaveBeenCalledOnce()
  expect(getAuthenticatedUser).not.toHaveBeenCalled()
  resume()
  await response
  expect(getAuthenticatedUser).toHaveBeenCalledOnce()
})
