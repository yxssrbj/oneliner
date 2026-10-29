// @vitest-environment jsdom
import { Activity } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import SettingsClient from './settings-client'

const appearance = vi.hoisted(() => ({ initialTheme: 'dark' as 'dark' | 'light' }))
vi.mock('../components/account-controls', async () => {
  const {useState} = await import('react')
  return {useAccountTheme: () => {
    const [theme, setTheme] = useState(appearance.initialTheme)
    return {theme, ownerConfirmed: true, confirmTheme: (next: 'dark' | 'light') => { setTheme(next); document.documentElement.dataset.theme = next; return true }}
  }}
})

const { refresh, onAuthStateChange, fetchMock, saveAccountMetadata } = vi.hoisted(() => ({ refresh: vi.fn(), onAuthStateChange: vi.fn(), fetchMock: vi.fn(), saveAccountMetadata: vi.fn() }))
vi.mock('next/navigation', () => { const router = { refresh }; return { useRouter: () => router } })
vi.mock('../../lib/supabase/client', () => ({ isLocalSignOutPending: () => false, saveAccountMetadata, createSupabaseBrowserClient: () => ({ auth: { onAuthStateChange } }) }))

beforeEach(() => {
  cleanup(); vi.clearAllMocks()
  appearance.initialTheme = 'dark'
  document.documentElement.dataset.theme = 'dark'
  saveAccountMetadata.mockResolvedValue({ data: { user: { id: 'one', user_metadata: { oneliner_theme: 'light' } } }, error: null })
  vi.stubGlobal('fetch', fetchMock)
  onAuthStateChange.mockImplementation(listener => {
    listener('INITIAL_SESSION', { user: { id: 'one' } })
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  fetchMock.mockResolvedValue(Response.json({ displayName: 'New name' }))
})
function show() { return render(<SettingsClient userId="one" email="one@example.test" initialDisplayName="River" />) }
function edit(value: string) { fireEvent.change(screen.getByLabelText('Display name'), { target: { value } }) }
function submit() { fireEvent.submit(screen.getByRole('button', { name: 'Save display name' }).closest('form')!) }

test('shows the own read-only email and confirmed profile identity', () => {
  show()
  expect(screen.getByLabelText('Email address')).toHaveValue('one@example.test')
  expect(screen.getByLabelText('Email address')).toHaveAttribute('readonly')
  expect(screen.getByLabelText('Display name')).toHaveValue('River')
  expect(screen.getByText('River')).toBeVisible()
})
test('an absent profile uses Trader without fabricating an editable name', () => {
  render(<SettingsClient userId="one" email="one@example.test" initialDisplayName={null} />)
  expect(screen.getByText('Trader')).toBeVisible()
  expect(screen.getByLabelText('Display name')).toHaveValue('')
  expect(fetchMock).not.toHaveBeenCalled()
})
test.each(['   ', 'x'.repeat(81)])('blocks an invalid display name (%s)', name => {
  show(); edit(name); submit()
  expect(screen.getByRole('alert')).toHaveTextContent('Display name must be 1–80 characters.')
  expect(screen.getByLabelText('Display name')).toHaveValue(name)
  expect(fetchMock).not.toHaveBeenCalled()
})
test.each(['http', 'network', 'malformed'])('a %s failure preserves the edit and confirmed identity', async failure => {
  if (failure === 'http') fetchMock.mockResolvedValue(Response.json({ error: 'Could not save profile.' }, { status: 500 }))
  if (failure === 'network') fetchMock.mockRejectedValue(new Error('offline'))
  if (failure === 'malformed') fetchMock.mockResolvedValue(Response.json({}))
  show(); edit('Unsaved'); submit()
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save display name. Try again.')
  expect(screen.getByLabelText('Display name')).toHaveValue('Unsaved')
  expect(screen.getByText('River')).toBeVisible()
  expect(refresh).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Save display name' })).toBeEnabled()
})
test('confirmed save uses the returned name and refreshes shared identities', async () => {
  show(); edit(' New name '); submit()
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Display name saved.'))
  expect(fetchMock).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ displayName: 'New name' }) }))
  expect(screen.getByLabelText('Display name')).toHaveValue('New name')
  expect(screen.getByText('New name')).toBeVisible()
  expect(refresh).toHaveBeenCalledTimes(1)
})
test('a pending save is disabled and submits once', async () => {
  let finish!: (response: Response) => void
  fetchMock.mockReturnValue(new Promise(resolve => { finish = resolve }))
  show(); edit('New name'); submit()
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  expect(screen.getByLabelText('Display name')).toBeDisabled()
  fireEvent.submit(screen.getByRole('button', { name: 'Saving…' }).closest('form')!)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await act(async () => finish(Response.json({ displayName: 'New name' })))
})
test.each([['SIGNED_OUT', null], ['SIGNED_IN', { user: { id: 'two' } }]])('external %s hides private fields even when a stale save finishes', async (event, session) => {
  let finish!: (response: Response) => void
  fetchMock.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const view = show(); edit('Unsaved'); submit()
  act(() => onAuthStateChange.mock.calls[0][0](event, session))
  expect(screen.queryByDisplayValue('one@example.test')).not.toBeInTheDocument()
  expect(screen.queryByDisplayValue('Unsaved')).not.toBeInTheDocument()
  expect(screen.queryByText('River')).not.toBeInTheDocument()
  expect(refresh).toHaveBeenCalledTimes(1)
  await act(async () => finish(Response.json({ displayName: 'Old account' })))
  expect(screen.queryByText('Old account')).not.toBeInTheDocument()
  expect(refresh).toHaveBeenCalledTimes(1)
  view.rerender(<SettingsClient userId="one" email="one@example.test" initialDisplayName="Old account" />)
  expect(screen.queryByDisplayValue('one@example.test')).not.toBeInTheDocument()
})
test('an unmounted save cannot refresh a replacement page', async () => {
  let finish!: (response: Response) => void
  fetchMock.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const view = show(); edit('New name'); submit(); view.unmount()
  await act(async () => finish(Response.json({ displayName: 'New name' })))
  expect(refresh).not.toHaveBeenCalled()
})

test('settings fields keep their labels when the cached groups form remains mounted', () => {
  render(<><label htmlFor="display-name">Display name</label><input id="display-name" hidden /><SettingsClient userId="one" email="one@example.test" initialDisplayName="River" /></>)
  expect(screen.getByRole('textbox', { name: 'Display name' })).toHaveValue('River')
})

test('keeps private identity absent until the browser confirms the authenticated owner', () => {
  onAuthStateChange.mockImplementation(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
  show()
  expect(screen.queryByDisplayValue('one@example.test')).not.toBeInTheDocument()
  expect(screen.queryByDisplayValue('River')).not.toBeInTheDocument()
  expect(screen.queryByText('River')).not.toBeInTheDocument()
  act(() => onAuthStateChange.mock.calls[0][0]('INITIAL_SESSION', { user: { id: 'one' } }))
  expect(screen.getByLabelText('Display name')).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Save display name' })).toBeEnabled()
})

test('a delayed mismatched initial session never reveals the server account identity', () => {
  onAuthStateChange.mockImplementation(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
  show()
  expect(screen.queryByDisplayValue('one@example.test')).not.toBeInTheDocument()
  expect(screen.queryByText('River')).not.toBeInTheDocument()
  act(() => onAuthStateChange.mock.calls[0][0]('INITIAL_SESSION', { user: { id: 'two' } }))
  expect(screen.queryByDisplayValue('one@example.test')).not.toBeInTheDocument()
  expect(screen.queryByText('River')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Save display name' })).not.toBeInTheDocument()
  expect(refresh).toHaveBeenCalledTimes(1)
})


test('theme save preserves current metadata and unsaved profile input until confirmed', async () => {
  let finish!: (value: unknown) => void
  saveAccountMetadata.mockReturnValue(new Promise(resolve => { finish = resolve }))
  show(); edit('Unsaved name')
  act(() => onAuthStateChange.mock.calls[0][0]('USER_UPDATED', { user: { id: 'one', user_metadata: { other: 'keep', oneliner_theme: 'dark' } } }))
  fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
  expect(saveAccountMetadata).toHaveBeenCalledWith('one', { other: 'keep', oneliner_theme: 'light' })
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(screen.getByRole('button', { name: 'Saving appearance…' })).toBeDisabled()
  await act(async () => finish({ data: { user: { id: 'one', user_metadata: { oneliner_theme: 'light' } } }, error: null }))
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeEnabled()
  expect(screen.getByLabelText('Display name')).toHaveValue('Unsaved name')
  expect(refresh).toHaveBeenCalledTimes(1)
})

test.each(['http', 'network', 'missing', 'wrong-owner', 'unconfirmed'])('a %s theme failure keeps the confirmed theme and allows retry', async failure => {
  if (failure === 'http') saveAccountMetadata.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Unavailable' } })
  if (failure === 'network') saveAccountMetadata.mockRejectedValueOnce(new Error('Offline'))
  if (failure === 'missing') saveAccountMetadata.mockResolvedValueOnce({ data: { user: null }, error: null })
  if (failure === 'wrong-owner') saveAccountMetadata.mockResolvedValueOnce({ data: { user: { id: 'two', user_metadata: { oneliner_theme: 'light' } } }, error: null })
  if (failure === 'unconfirmed') saveAccountMetadata.mockResolvedValueOnce({ data: { user: { id: 'one', user_metadata: { oneliner_theme: 'dark' } } }, error: null })
  show(); edit('Unsaved name')
  fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save appearance. Try again.')
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(screen.getByLabelText('Display name')).toHaveValue('Unsaved name')
  expect(refresh).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
  await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'))
})

test.each([['SIGNED_OUT', null], ['SIGNED_IN', { user: { id: 'two' } }]])('a late theme response after %s cannot restore an old account', async (event, session) => {
  let finish!: (value: unknown) => void
  saveAccountMetadata.mockReturnValue(new Promise(resolve => { finish = resolve }))
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
  act(() => onAuthStateChange.mock.calls[0][0](event, session))
  document.documentElement.dataset.theme = 'dark'
  act(() => onAuthStateChange.mock.calls[0][0]('USER_UPDATED', { user: { id: 'one', user_metadata: { oneliner_theme: 'light' } } }))
  await act(async () => finish({ data: { user: { id: 'one', user_metadata: { oneliner_theme: 'light' } } }, error: null }))
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(screen.queryByRole('button', { name: 'Switch to dark mode' })).not.toBeInTheDocument()
  expect(refresh).toHaveBeenCalledTimes(1)
})

test('a theme response after unmount cannot recolor the next document', async () => {
  let finish!: (value: unknown) => void
  saveAccountMetadata.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const view = show()
  fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
  view.unmount()
  await act(async () => finish({ data: { user: { id: 'one', user_metadata: { oneliner_theme: 'light' } } }, error: null }))
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(refresh).not.toHaveBeenCalled()
})


test('the single appearance action shares the settings page title row', () => {
  show()
  const heading = screen.getByRole('heading', {name: 'Settings', level: 1})
  expect(heading.closest('.settings-heading')).toContainElement(screen.getByRole('button', {name: 'Switch to light mode'}))
})


test.each([undefined, {}, { oneliner_theme: 'invalid' }])('switching to dark requires a confirmed dark value (%j)', async user_metadata => {
  appearance.initialTheme = 'light'
  document.documentElement.dataset.theme = 'light'
  saveAccountMetadata.mockResolvedValueOnce({ data: { user: { id: 'one', user_metadata } }, error: null })
  render(<SettingsClient userId="one" email="one@example.test" initialDisplayName="River" />)
  fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save appearance. Try again.')
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  expect(refresh).not.toHaveBeenCalled()
})


test('a delayed theme save cannot regain ownership when a cached page resumes', async () => {
  let finish!: (value: unknown) => void
  saveAccountMetadata.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const settings = <SettingsClient userId="one" email="one@example.test" initialDisplayName="River" />
  const view = render(<Activity mode="visible">{settings}</Activity>)
  fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
  view.rerender(<Activity mode="hidden">{settings}</Activity>)
  onAuthStateChange.mockImplementation(() => ({data: {subscription: {unsubscribe: vi.fn()}}}))
  view.rerender(<Activity mode="visible">{settings}</Activity>)
  expect(screen.queryByDisplayValue('one@example.test')).not.toBeInTheDocument()
  await act(async () => finish({ data: { user: { id: 'one', user_metadata: { oneliner_theme: 'light' } } }, error: null }))
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(refresh).not.toHaveBeenCalled()
  act(() => onAuthStateChange.mock.calls.at(-1)![0]('INITIAL_SESSION', {user: {id: 'one'}}))
  expect(screen.getByRole('button', {name: 'Switch to light mode'})).toBeEnabled()
  saveAccountMetadata.mockResolvedValueOnce({data: {user: {id: 'one', user_metadata: {oneliner_theme: 'light'}}}, error: null})
  fireEvent.click(screen.getByRole('button', {name: 'Switch to light mode'}))
  await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'))
  expect(refresh).toHaveBeenCalledTimes(1)
})
