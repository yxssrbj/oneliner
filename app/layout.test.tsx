import { beforeEach, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import RootLayout from './layout'

const { getAuthenticatedUser, io } = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn(), io: vi.fn() }))
vi.mock('./components/account-controls', () => ({ AccountTheme: () => null }))
vi.mock('../lib/supabase/server', () => ({ getAuthenticatedUser }))
vi.mock('next/cache', () => ({ io }))
beforeEach(() => { vi.clearAllMocks(); io.mockResolvedValue(undefined) })

test.each([['light', 'light'], ['dark', 'dark'], ['invalid', 'dark'], [undefined, 'dark']])('server document renders the verified account theme %s as %s', async (value, expected) => {
  getAuthenticatedUser.mockResolvedValue({ user: { id: 'one', user_metadata: { oneliner_theme: value } } })
  const html = renderToStaticMarkup(await RootLayout({ params: Promise.resolve({}), children: <main>Workspace</main> }))
  expect(html).toContain(`data-theme="${expected}"`)
})
test('signed-out document defaults to dark', async () => {
  getAuthenticatedUser.mockResolvedValue(null)
  const html = renderToStaticMarkup(await RootLayout({ params: Promise.resolve({}), children: <main>Sign in</main> }))
  expect(html).toContain('data-theme="dark"')
})
test('runtime rendering precedes session initialization', async () => {
  let proceed!: () => void
  io.mockReturnValue(new Promise<void>(resolve => { proceed = resolve }))
  getAuthenticatedUser.mockResolvedValue(null)
  const layout = RootLayout({ params: Promise.resolve({}), children: null })
  expect(getAuthenticatedUser).not.toHaveBeenCalled()
  proceed()
  await layout
  expect(getAuthenticatedUser).toHaveBeenCalledTimes(1)
})
