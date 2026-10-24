// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import SettingsClient from './settings-client'

const { refresh, onAuthStateChange, fetchMock } = vi.hoisted(() => ({ refresh: vi.fn(), onAuthStateChange: vi.fn(), fetchMock: vi.fn() }))
vi.mock('next/navigation', () => { const router = { refresh }; return { useRouter: () => router } })
vi.mock('../../lib/supabase/client', () => ({ isLocalSignOutPending: () => false, createSupabaseBrowserClient: () => ({ auth: { onAuthStateChange } }) }))

beforeEach(() => {
  cleanup(); vi.clearAllMocks()
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
