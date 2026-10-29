// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest'
import { Activity } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import CaptureForm from './capture-form'
const fetchMock = vi.fn()
const recentMock = vi.fn()
const unsubscribe = vi.fn()
type AuthSession = { user: { id: string } } | null
let authChanged: (event: string, session?: AuthSession) => void
let autoConfirm = true
vi.mock('../../lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ auth: { onAuthStateChange: (fn: (event: string, session?: AuthSession) => void) => { authChanged = fn; if (autoConfirm) fn('INITIAL_SESSION', { user: { id: 'owner' } }); return { data: { subscription: { unsubscribe } } } } } }) }))
beforeEach(() => { cleanup(); autoConfirm = true; sessionStorage.clear(); vi.stubGlobal('fetch', (url: string, options?: RequestInit) => url === '/api/trades?recent=3' ? recentMock() : fetchMock(url, options)); fetchMock.mockReset(); recentMock.mockReset(); recentMock.mockImplementation(async () => Response.json({ trades: [] })) })
const suggestion = { symbol: 'CL', side: 'short', entryPrice: '87.64', stopPrice: null, setup: 'ORB', clarifications: ['Please confirm the initial stop price.'] }
test('capture follows the desktop preview composition with live data', async () => {
  render(<CaptureForm userId="owner" />)
  expect(await screen.findByRole('heading', { name: 'One line. A clearer picture.' })).toBeVisible()
  expect(screen.getByRole('heading', { name: '01 Capture the moment' })).toBeVisible()
  expect(screen.getByText('Your original note stays with the trade.')).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Recently captured' })).toBeVisible()
  expect(await screen.findByText('No trades saved yet.')).toBeVisible()
})
test('Add shows parsed details before saving and offers explicit editing', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ suggestion: { symbol: 'CL', side: 'short', entryPrice: '87.64', stopPrice: '87.90', setup: 'ORB', clarifications: [] } }))
    .mockResolvedValueOnce(Response.json({ trade: { id: 'saved' } }, { status: 201 }))
  render(<CaptureForm userId="owner" />)
  await userEvent.type(await screen.findByLabelText('Trade note'), 'CL short 87.64 stop 87.90 ORB')
  await userEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(await screen.findByRole('button', { name: 'Edit details' })).toBeVisible()
  expect(screen.getByText('87.64')).toBeVisible()
  expect(screen.getByText('87.90')).toBeVisible()
  expect(screen.queryByLabelText('Symbol')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Enter details manually' })).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByRole('button', { name: 'Edit details' }))
  expect(screen.getByLabelText('Symbol')).toBeVisible()
  await userEvent.clear(screen.getByLabelText('Setup name'))
  await userEvent.type(screen.getByLabelText('Setup name'), 'Opening range breakout')
  await userEvent.click(screen.getByRole('button', { name: 'Save trade' }))
  expect(await screen.findByText('Trade saved.')).toBeVisible()
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ originalNote: 'CL short 87.64 stop 87.90 ORB', setup: 'Opening range breakout' })
})
test('ambiguous parse stays editable and failed save retains original note and retry key', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ suggestion })).mockResolvedValueOnce(Response.json({ error: 'Could not save.' }, { status: 500 })).mockResolvedValueOnce(Response.json({ trade: { id: 'saved' } }, { status: 201 }))
  render(<CaptureForm userId="owner" />)
  const note = ' CL short 87.64 ORB '
  await userEvent.type(await screen.findByLabelText('Trade note'), note)
  await userEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(await screen.findByText('Please confirm the initial stop price.')).toBeInTheDocument()
  expect(screen.getByLabelText('Initial stop')).toHaveValue('')
  await userEvent.type(screen.getByLabelText('Initial stop'), '87.90')
  await userEvent.click(screen.getByRole('button', { name: 'Save trade' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
  expect(screen.queryByText('Trade saved.')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Trade note')).toHaveValue(note)
  expect(screen.getByLabelText('Initial stop')).toHaveValue('87.90')
  const persisted = JSON.parse(sessionStorage.getItem('oneliner:capture:owner')!)
  expect(persisted.draft.originalNote).toBe(note)
  await userEvent.click(screen.getByRole('button', { name: 'Save trade' }))
  expect(await screen.findByText('Trade saved.')).toBeInTheDocument()
  const saves = fetchMock.mock.calls.filter(([url]) => url === '/api/trades')
  expect(saves[0][1].headers['Idempotency-Key']).toBe(saves[1][1].headers['Idempotency-Key'])
  expect(sessionStorage.getItem('oneliner:capture:owner')).toBeNull()
})
test('parser failure preserves manually corrected fields', async () => {
  fetchMock.mockResolvedValue(Response.json({ error: 'Parsing unavailable; enter fields manually.' }, { status: 503 }))
  render(<CaptureForm userId="owner" />)
  await userEvent.type(await screen.findByLabelText('Trade note'), 'my note')
  await userEvent.click(screen.getByRole('button', { name: 'Enter details manually' }))
  await userEvent.type(screen.getByLabelText('Symbol'), 'CL')
  await userEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('manually')
  expect(screen.getByLabelText('Symbol')).toHaveValue('CL')
})
test('refresh restores only this user draft and sign-out clears it', async () => {
  const draft = { originalNote: 'private', symbol: 'ES', side: 'long', entryPrice: '10', stopPrice: '9', setup: 'ORB', openedAt: '2026-10-19T10:00' }
  sessionStorage.setItem('oneliner:capture:owner', JSON.stringify({ draft, idempotencyKey: 'key' }))
  render(<CaptureForm userId="owner" />)
  expect(await screen.findByLabelText('Trade note')).toHaveValue('private')
  authChanged('SIGNED_OUT')
  await waitFor(() => expect(sessionStorage.getItem('oneliner:capture:owner')).toBeNull())
})
test('disables repeated saves while confirmation is pending', async () => {
  const draft = { originalNote: 'CL short', symbol: 'CL', side: 'short', entryPrice: '87.64', stopPrice: '87.90', setup: 'ORB', openedAt: '2026-10-19T10:00' }
  sessionStorage.setItem('oneliner:capture:owner', JSON.stringify({ draft, idempotencyKey: '00000000-0000-4000-8000-000000000001' }))
  let confirm!: (response: Response) => void
  fetchMock.mockReturnValue(new Promise<Response>((resolve) => { confirm = resolve }))
  render(<CaptureForm userId="owner" />)
  await userEvent.dblClick(await screen.findByRole('button', { name: 'Save trade' }))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  expect(screen.queryByText('Trade saved.')).not.toBeInTheDocument()
  confirm(Response.json({ trade: { id: 'saved' } }))
  expect(await screen.findByText('Trade saved.')).toBeInTheDocument()
})

test('account replacement clears the previous private draft and prevents submission', async () => {
  const draft = { originalNote: 'private account A note', symbol: 'ES', side: 'long', entryPrice: '10', stopPrice: '9', setup: 'ORB', openedAt: '2026-10-19T10:00' }
  sessionStorage.setItem('oneliner:capture:owner', JSON.stringify({ draft, idempotencyKey: '00000000-0000-4000-8000-000000000001' }))
  render(<CaptureForm userId="owner" />)
  expect(await screen.findByLabelText('Trade note')).toHaveValue(draft.originalNote)
  act(() => authChanged('SIGNED_IN', { user: { id: 'another-account' } }))
  expect(sessionStorage.getItem('oneliner:capture:owner')).toBeNull()
  expect(screen.queryByLabelText('Trade note')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Save trade' })).not.toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})
test.each(['parse', 'save'])('ignores pending %s results after the account changes', async (operation) => {
  const draft = { originalNote: 'private account A note', symbol: 'ES', side: 'long', entryPrice: '10', stopPrice: '9', setup: 'ORB', openedAt: '2026-10-19T10:00' }
  sessionStorage.setItem('oneliner:capture:owner', JSON.stringify({ draft, idempotencyKey: '00000000-0000-4000-8000-000000000001' }))
  let complete!: (response: Response) => void
  fetchMock.mockReturnValue(new Promise<Response>((resolve) => { complete = resolve }))
  render(<CaptureForm userId="owner" />)
  await userEvent.click(await screen.findByRole('button', { name: operation === 'parse' ? 'Add' : 'Save trade' }))
  act(() => authChanged('SIGNED_IN', { user: { id: 'another-account' } }))
  await act(async () => { complete(Response.json(operation === 'parse' ? { suggestion } : { trade: { id: 'saved' } })) })
  expect(sessionStorage.getItem('oneliner:capture:owner')).toBeNull()
  expect(screen.queryByLabelText('Trade note')).not.toBeInTheDocument()
  expect(screen.queryByText('Trade saved.')).not.toBeInTheDocument()
})

test('resumed capture hides a stored private draft until its owner is confirmed', async () => {
  autoConfirm = false
  const draft = { originalNote: 'account A private note', symbol: 'ES', side: 'long', entryPrice: '10', stopPrice: '9', setup: 'ORB', openedAt: '2026-10-19T10:00' }
  sessionStorage.setItem('oneliner:capture:owner', JSON.stringify({ draft, idempotencyKey: 'key' }))
  const content = (mode: 'hidden' | 'visible') => <Activity mode={mode}><CaptureForm userId="owner" /></Activity>
  const view = render(content('visible'))
  act(() => authChanged('INITIAL_SESSION', { user: { id: 'owner' } }))
  expect(screen.getByLabelText('Trade note')).toHaveValue(draft.originalNote)
  view.rerender(content('hidden'))
  view.rerender(content('visible'))
  expect(screen.queryByDisplayValue(draft.originalNote)).not.toBeInTheDocument()
  act(() => authChanged('INITIAL_SESSION', null))
  expect(screen.queryByDisplayValue(draft.originalNote)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Save trade' })).not.toBeInTheDocument()
  act(() => authChanged('SIGNED_IN', { user: { id: 'owner' } }))
  expect(screen.getByLabelText('Trade note')).toHaveValue(draft.originalNote)
})

test('empty initial session keeps an owner draft private until sign-in', () => {
  autoConfirm = false
  const draft = { originalNote: 'owner draft after refresh', symbol: 'ES', side: 'long', entryPrice: '10', stopPrice: '9', setup: 'ORB', openedAt: '2026-10-19T10:00' }
  sessionStorage.setItem('oneliner:capture:owner', JSON.stringify({ draft, idempotencyKey: 'key' }))
  render(<CaptureForm userId="owner" />)
  act(() => authChanged('INITIAL_SESSION', null))
  expect(screen.queryByDisplayValue(draft.originalNote)).not.toBeInTheDocument()
  act(() => authChanged('SIGNED_IN', { user: { id: 'owner' } }))
  expect(screen.getByLabelText('Trade note')).toHaveValue(draft.originalNote)
})

test('capture ignores a queued edit after browser owner confirmation is lost', () => {
  const draft = { originalNote: 'private draft', symbol: 'ES', side: 'long', entryPrice: '10', stopPrice: '9', setup: 'ORB', openedAt: '2026-10-19T10:00' }
  sessionStorage.setItem('oneliner:capture:owner', JSON.stringify({ draft, idempotencyKey: 'key' }))
  render(<CaptureForm userId="owner" />)
  const note = screen.getByLabelText('Trade note')
  act(() => {
    authChanged('INITIAL_SESSION', null)
    fireEvent.change(note, { target: { value: 'stale edit' } })
  })
  expect(JSON.parse(sessionStorage.getItem('oneliner:capture:owner')!).draft.originalNote).toBe('private draft')
})


test('note-first capture reveals manual details without AI and accepts optional exit', async () => {
  fetchMock.mockResolvedValue(Response.json({ trade: { id: 'saved' } }))
  render(<CaptureForm userId="owner" />)
  await userEvent.type(await screen.findByLabelText('Trade note'), ' exact note ')
  expect(screen.getByLabelText('Symbol')).not.toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Enter details manually' }))
  await userEvent.type(screen.getByLabelText('Symbol'), 'ES')
  await userEvent.selectOptions(screen.getByLabelText('Direction'), 'long')
  await userEvent.type(screen.getByLabelText('Entry price'), '10')
  await userEvent.type(screen.getByLabelText('Initial stop'), '9')
  await userEvent.type(screen.getByLabelText('Setup name'), 'ORB')
  await userEvent.type(screen.getByLabelText('Exit price (optional)'), '12')
  expect(fetchMock).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Save trade' }))
  expect(await screen.findByText('Trade saved.')).toBeInTheDocument()
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ originalNote: ' exact note ', exitPrice: '12' })
  await waitFor(() => expect(recentMock).toHaveBeenCalledTimes(2))
})
test('parser failure reveals editable details and retains the note', async () => {
  fetchMock.mockResolvedValue(Response.json({ error: 'Parser unavailable' }, { status: 503 }))
  render(<CaptureForm userId="owner" />)
  await userEvent.type(await screen.findByLabelText('Trade note'), 'note kept')
  await userEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Parser unavailable')
  expect(screen.getByLabelText('Symbol')).toBeEnabled()
  expect(screen.getByLabelText('Trade note')).toHaveValue('note kept')
})
test('recent empty and retryable failure states are distinct', async () => {
  recentMock.mockResolvedValueOnce(Response.json({ error: 'Could not load recent trades.' }, { status: 503 }))
  render(<CaptureForm userId="owner" />)
  expect(await screen.findByText('Could not load recent trades.')).toBeInTheDocument()
  expect(screen.queryByText('No trades saved yet.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Retry recent trades' }))
  expect(await screen.findByText('No trades saved yet.')).toBeInTheDocument()
})
test('recent waits for owner confirmation and ignores late results after account change', async () => {
  autoConfirm = false
  let complete!: (response: Response) => void
  recentMock.mockReturnValue(new Promise<Response>(resolve => { complete = resolve }))
  render(<CaptureForm userId="owner" />)
  expect(recentMock).not.toHaveBeenCalled()
  act(() => authChanged('SIGNED_IN', { user: { id: 'owner' } }))
  await waitFor(() => expect(recentMock).toHaveBeenCalledOnce())
  act(() => authChanged('SIGNED_IN', { user: { id: 'other' } }))
  await act(async () => complete(Response.json({ trades: [{ id: 'secret', symbol: 'ES', side: 'long', setup: 'ORB', original_note: 'private recent note', exit_price: null, r_result: null }] })))
  expect(screen.queryByText('private recent note')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Recent trades' })).not.toBeInTheDocument()
})
test('recent shows real saved notes and server results then clears on sign-out', async () => {
  recentMock.mockResolvedValue(Response.json({ trades: [{ id: 'recent', symbol: 'ES', side: 'long', setup: 'ORB', original_note: 'my saved note', exit_price: '12', r_result: '2' }] }))
  render(<CaptureForm userId="owner" />)
  expect(await screen.findByText('my saved note')).toBeInTheDocument()
  expect(screen.getByText('Win · +2.00R')).toBeInTheDocument()
  act(() => authChanged('SIGNED_OUT'))
  expect(screen.queryByText('my saved note')).not.toBeInTheDocument()
})

for (const field of ['stopPrice', 'exitPrice'] as const) {
  test(`restores visible review fields when only ${field} was entered`, async () => {
    const draft = { originalNote: '', symbol: '', side: '', entryPrice: '', stopPrice: '', setup: '', openedAt: '2026-10-19T10:00', [field]: '9' }
    sessionStorage.setItem('oneliner:capture:owner', JSON.stringify({ draft, idempotencyKey: 'key' }))
    render(<CaptureForm userId="owner" />)
    const input = await screen.findByLabelText(field === 'stopPrice' ? 'Initial stop' : 'Exit price (optional)')
    expect(input).toBeVisible()
    expect(input).toHaveValue('9')
  })
}
