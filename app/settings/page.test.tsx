// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import SettingsPage from './page'

const browserOwner = vi.hoisted(() => ({ id: 'one' }))
const { getAuthenticatedUser, from, select, eq, single, io } = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn(), io: vi.fn() }))
vi.mock('../components/account-controls', () => ({useAccountTheme: () => ({theme: 'dark', ownerConfirmed: true, confirmTheme: () => true})}))
vi.mock('next/cache', () => ({ io }))
vi.mock('../../lib/supabase/server', () => ({ getAuthenticatedUser }))
vi.mock('../components/app-shell', () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }))
vi.mock('next/navigation', () => { const router = {refresh: vi.fn()}; return { redirect: (url: string) => { throw new Error(`redirect:${url}`) }, useRouter: () => router } })
vi.mock('../../lib/supabase/client', () => ({ isLocalSignOutPending: () => false, createSupabaseBrowserClient: () => ({ auth: { onAuthStateChange: (listener: (event: string, session: { user: { id: string } }) => void) => { listener('INITIAL_SESSION', { user: { id: browserOwner.id } }); return { data: { subscription: { unsubscribe: vi.fn() } } } } } }) }))
beforeEach(() => {
  cleanup(); vi.clearAllMocks()
  browserOwner.id = 'one'
  io.mockResolvedValue(undefined)
  single.mockResolvedValue({ data: { display_name: 'River' }, error: null })
  eq.mockReturnValue({ single }); select.mockReturnValue({ eq }); from.mockReturnValue({ select })
  getAuthenticatedUser.mockResolvedValue({ user: { id: 'one', email: 'one@example.test' }, supabase: { from } })
})
test('redirects signed-out visitors before a profile read', async () => {
  getAuthenticatedUser.mockResolvedValue(null)
  await expect(SettingsPage()).rejects.toThrow('redirect:/sign-in')
  expect(from).not.toHaveBeenCalled()
})
test('loads only the signed-in profile and email', async () => {
  render(await SettingsPage())
  expect(screen.getByLabelText('Email address')).toHaveValue('one@example.test')
  expect(screen.getByLabelText('Display name')).toHaveValue('River')
  expect(from).toHaveBeenCalledWith('profiles')
  expect(select).toHaveBeenCalledWith('display_name')
  expect(eq).toHaveBeenCalledWith('id', 'one')
})
test('a new authenticated owner receives fresh profile state', async () => {
  const view = render(await SettingsPage())
  browserOwner.id = 'two'
  getAuthenticatedUser.mockResolvedValue({ user: { id: 'two', email: 'two@example.test' }, supabase: { from } })
  single.mockResolvedValue({ data: { display_name: 'Second trader' }, error: null })
  view.rerender(await SettingsPage())
  expect(screen.getByLabelText('Email address')).toHaveValue('two@example.test')
  expect(screen.getByLabelText('Display name')).toHaveValue('Second trader')
  expect(screen.queryByText('River')).not.toBeInTheDocument()
  expect(eq).toHaveBeenLastCalledWith('id', 'two')
})
test('a missing profile uses a neutral label without an error', async () => {
  single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
  render(await SettingsPage())
  expect(screen.getByText('Trader')).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
test('a failed profile lookup is explicit and never presents unconfirmed data', async () => {
  single.mockResolvedValue({ data: { display_name: 'Unconfirmed' }, error: { code: 'broken' } })
  render(await SettingsPage())
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load display name.')
  expect(screen.getByLabelText('Display name')).toHaveValue('')
  expect(screen.queryByText('Unconfirmed')).not.toBeInTheDocument()
})

test('waits for runtime rendering before reading private identity', async () => {
  let connect!: () => void
  io.mockReturnValue(new Promise<void>(resolve => { connect = resolve }))
  const page = SettingsPage()
  expect(getAuthenticatedUser).not.toHaveBeenCalled()
  connect()
  render(await page)
  expect(screen.getByLabelText('Email address')).toHaveValue('one@example.test')
})

test('settings has one standalone sign-out below its cards', async () => {
  render(await SettingsPage())
  const buttons = screen.getAllByRole('button', {name: 'Sign out'})
  expect(buttons).toHaveLength(1)
  expect(buttons[0].closest('.settings-panel')).toBeNull()
  expect(screen.getByRole('heading', {name: 'Profile'}).compareDocumentPosition(buttons[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
