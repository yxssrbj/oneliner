// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import ExitForm from './exit-form'
import TradeEditForm, { type SavedTrade } from './trade-edit-form'
import TradeWorkspace from './trade-workspace'
const fetchMock = vi.fn()
let authChanged: (event: string, session?: { user: { id: string } }) => void
vi.mock('../../lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ auth: { onAuthStateChange: (fn: typeof authChanged) => { authChanged = fn; return { data: { subscription: { unsubscribe() {} } } } } } }) }))
const trade: SavedTrade = { id: 'trade', original_note: 'my original note', symbol: 'ES', side: 'long', entry_price: '10', stop_price: '9', setup: 'ORB', opened_at: '2026-10-19T10:00:00Z', exit_price: null, r_result: null }
beforeEach(() => { cleanup(); vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
test('exit save keeps failed input and shows database R and label after retry', async () => {
  const saved = vi.fn()
  fetchMock.mockResolvedValueOnce(Response.json({ error: 'Retry saving.' }, { status: 500 })).mockResolvedValueOnce(Response.json({ trade: { ...trade, exit_price: '12', r_result: '2' } }))
  render(<ExitForm trade={trade} onSaved={saved} />)
  await userEvent.type(screen.getByLabelText('Exit price'), '12')
  await userEvent.click(screen.getByRole('button', { name: 'Save exit' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Retry saving.')
  expect(screen.getByLabelText('Exit price')).toHaveValue('12')
  expect(saved).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Save exit' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Win · +2.00R')
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ exitPrice: '12' })
})
test('trade correction validates stops and requires explicit confirmation', async () => {
  const saved = vi.fn()
  fetchMock.mockResolvedValue(Response.json({ trade: { ...trade, entry_price: '11' } }))
  render(<TradeEditForm trade={trade} onSaved={saved} />)
  await userEvent.clear(screen.getByLabelText('Initial stop'))
  await userEvent.type(screen.getByLabelText('Initial stop'), '12')
  await userEvent.click(screen.getByLabelText('I reviewed these corrections'))
  await userEvent.click(screen.getByRole('button', { name: 'Save corrections' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('below entry')
  expect(fetchMock).not.toHaveBeenCalled()
  await userEvent.clear(screen.getByLabelText('Initial stop'))
  await userEvent.type(screen.getByLabelText('Initial stop'), '9')
  await userEvent.click(screen.getByLabelText('I reviewed these corrections'))
  await userEvent.click(screen.getByRole('button', { name: 'Save corrections' }))
  await waitFor(() => expect(saved).toHaveBeenCalled())
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('originalNote')
})
test('review shows summary, daily table, pending and recent trades with original note', async () => {
  fetchMock.mockResolvedValue(Response.json({ trades: [trade], summary: { totalR: 0, completedCount: 0, unfinishedCount: 1, winRate: null, wins: 0 } }))
  render(<TradeWorkspace mode="review" userId="owner" initialWeek="2026-10-19" />)
  expect(await screen.findByRole('table', { name: 'Daily breakdown in UTC' })).toBeInTheDocument()
  expect(screen.getByText('Unavailable')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Pending outcomes' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Trades opened this week' })).toBeInTheDocument()
  expect(screen.getAllByText('my original note').length).toBeGreaterThan(0)
  expect(fetchMock.mock.calls[0][0]).toBe('/api/trades?weekStart=2026-10-19')
})
test('local demo review previews sample outcomes without reading or writing trades', async () => {
  render(<TradeWorkspace mode="review" userId="owner" initialWeek="2026-10-19" demo />)
  expect(await screen.findByRole('note')).toHaveTextContent('Demo preview — sample data only. Nothing is saved.')
  expect(screen.getByText((_, element) => element?.tagName === 'DD' && element.textContent === '+2.50R')).toBeInTheDocument()
  expect(screen.getByText('50.0%')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Pending outcomes' })).toBeInTheDocument()
  expect(screen.getAllByText('GC short 2671.3 orb stop 2676.3')).toHaveLength(2)
  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.queryByText('Add exit')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Previous week' }))
  await waitFor(() => expect(screen.getByText('25.0%')).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: 'Previous week' }))
  await waitFor(() => expect(screen.getByText('60.0%')).toBeInTheDocument())
  expect(screen.getByText((_, element) => element?.tagName === 'DD' && element.textContent === '+2.00R')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Previous week' }))
  expect(await screen.findByText('No trades opened this week.')).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})
test('load failures are recoverable and an empty inbox is clear', async () => {
  fetchMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json({ trades: [] }))
  render(<TradeWorkspace mode="inbox" userId="owner" initialWeek="2026-10-19" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load trades')
  await userEvent.click(screen.getByRole('button', { name: 'Retry loading' }))
  expect(await screen.findByText('All caught up. No trades are waiting for an exit.')).toBeInTheDocument()
})

test('account replacement hides notes and ignores a pending private response', async () => {
  let complete!: (response: Response) => void
  fetchMock.mockReturnValue(new Promise<Response>(resolve => { complete = resolve }))
  render(<TradeWorkspace mode="inbox" userId="owner" initialWeek="2026-10-19" />)
  act(() => authChanged('SIGNED_IN', { user: { id: 'other' } }))
  await act(async () => complete(Response.json({ trades: [trade] })))
  expect(screen.getByRole('alert')).toHaveTextContent('Your session changed')
  expect(screen.queryByText('my original note')).not.toBeInTheDocument()
})
test('correction preserves the original opening millisecond', async () => {
  fetchMock.mockResolvedValue(Response.json({ trade }))
  render(<TradeEditForm trade={{ ...trade, opened_at: '2026-10-18T23:59:59.999Z' }} onSaved={vi.fn()} />)
  await userEvent.click(screen.getByLabelText('I reviewed these corrections'))
  await userEvent.click(screen.getByRole('button', { name: 'Save corrections' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).openedAt).toBe('2026-10-18T23:59:59.999Z')
})
