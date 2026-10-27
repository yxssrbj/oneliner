// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest'
import { Activity } from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import ExitForm from './exit-form'
import TradeEditForm, { type SavedTrade } from './trade-edit-form'
import TradeWorkspace from './trade-workspace'
const fetchMock = vi.fn()
let authChanged: (event: string, session?: { user: { id: string } } | null) => void
let autoConfirm = true
vi.mock('../../lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ auth: { onAuthStateChange: (fn: typeof authChanged) => { authChanged = fn; if (autoConfirm) fn('INITIAL_SESSION', { user: { id: 'owner' } }); return { data: { subscription: { unsubscribe() {} } } } } } }) }))
const trade: SavedTrade = { id: 'trade', original_note: 'my original note', symbol: 'ES', side: 'long', entry_price: '10', stop_price: '9', setup: 'ORB', opened_at: '2026-10-19T10:00:00Z', exit_price: null, r_result: null }
beforeEach(() => { cleanup(); autoConfirm = true; vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
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
test('review shows an all-unfinished week with its original note', async () => {
  fetchMock.mockResolvedValue(Response.json({ trades: [trade], summary: { totalR: 0, completedCount: 0, unfinishedCount: 1, winRate: null, wins: 0 } }))
  render(<TradeWorkspace mode="review" userId="owner" initialWeek="2026-10-19" />)
  expect(await screen.findByRole('heading', { name: 'Each day' })).toBeInTheDocument()
  expect(screen.getAllByText('Unavailable')).toHaveLength(4)
  expect(screen.getByRole('link', { name: /Finish 1 unfinished trade/ })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Trades opened this week' })).toBeInTheDocument()
  expect(screen.getAllByText('my original note').length).toBeGreaterThan(0)
  expect(fetchMock.mock.calls[0][0]).toBe('/api/trades?weekStart=2026-10-19')
})
test('review shows reconciled metrics, chart, setups, daily cards, and trade table', async () => {
  const completed = { ...trade, id: 'closed', exit_price: '12', r_result: '2' }
  const loser = { ...trade, id: 'loser', setup: 'VWAP', exit_price: '9', r_result: '-1' }
  fetchMock.mockResolvedValue(Response.json({ trades: [trade, completed, loser] }))
  render(<TradeWorkspace mode="review" userId="owner" initialWeek="2026-10-19" />)
  expect(await screen.findByRole('heading', { name: 'Cumulative R' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: /Cumulative R chart/ })).toBeInTheDocument()
  expect(screen.getByText('Average R')).toBeInTheDocument()
  expect(screen.getByText('Best trade')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'By setup' })).toBeInTheDocument()
  expect(screen.getAllByText('VWAP').find(element => element.closest('.review-setup'))?.closest('.review-setup')?.querySelector('.review-setup-track span')).toHaveClass('outcome-loss')
  expect(screen.getByRole('table', { name: 'Trades opened this week' })).toHaveTextContent('my original note')
  expect(screen.getByRole('link', { name: /Finish 1 unfinished trade/ })).toHaveAttribute('href', '/inbox')
  await userEvent.click(screen.getAllByRole('button', { name: /Review ES trade/ })[0])
  expect(screen.getByText('Correct trade details')).toBeInTheDocument()
})

test('empty review does not invent performance or chart points', async () => {
  fetchMock.mockResolvedValue(Response.json({ trades: [] }))
  render(<TradeWorkspace mode="review" userId="owner" initialWeek="2026-10-19" />)
  expect(await screen.findByText('No trades opened this week.')).toBeInTheDocument()
  expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0)
  expect(screen.queryByRole('img', { name: /Cumulative R chart/ })).not.toBeInTheDocument()
})
test('failed review load shows retry without empty-week statistics', async () => {
  fetchMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json({ trades: [trade] }))
  render(<TradeWorkspace mode="review" userId="owner" initialWeek="2026-10-19" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load trades')
  expect(screen.queryByText('No trades opened this week.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Retry loading' }))
  expect(await screen.findByRole('table', { name: 'Trades opened this week' })).toHaveTextContent('my original note')
})
test('local demo review previews sample outcomes without reading or writing trades', async () => {
  render(<TradeWorkspace mode="review" userId="owner" initialWeek="2026-10-19" demo />)
  expect(await screen.findByRole('note')).toHaveTextContent('Demo preview — sample data only. Nothing is saved.')
  expect(screen.getByText((_, element) => element?.tagName === 'DD' && element.textContent === '+2.50R')).toBeInTheDocument()
  expect(screen.getByText('50.0%')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Finish 1 unfinished trade/ })).toBeInTheDocument()
  expect(screen.getAllByText('GC short 2671.3 orb stop 2676.3')).toHaveLength(1)
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

test('resumed workspace hides cached private notes until its owner is confirmed', async () => {
  autoConfirm = false
  fetchMock.mockResolvedValueOnce(Response.json({ trades: [trade] }))
  const content = (mode: 'hidden' | 'visible') => <Activity mode={mode}><TradeWorkspace mode="inbox" userId="owner" initialWeek="2026-10-19" /></Activity>
  const view = render(content('visible'))
  act(() => authChanged('INITIAL_SESSION', { user: { id: 'owner' } }))
  expect(await screen.findByText('my original note')).toBeInTheDocument()
  view.rerender(content('hidden'))
  fetchMock.mockReturnValue(new Promise(() => {}))
  view.rerender(content('visible'))
  expect(screen.queryByText('my original note')).not.toBeInTheDocument()
  act(() => authChanged('INITIAL_SESSION', null))
  expect(screen.queryByText('my original note')).not.toBeInTheDocument()
  expect(screen.queryByText('Add exit')).not.toBeInTheDocument()
  fetchMock.mockResolvedValueOnce(Response.json({ trades: [trade] }))
  act(() => authChanged('SIGNED_IN', { user: { id: 'owner' } }))
  expect(await screen.findByText('my original note')).toBeInTheDocument()
})

test('workspace does not show a previous owners cached notes when the route owner changes', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ trades: [trade] }))
  const view = render(<TradeWorkspace mode="inbox" userId="owner" initialWeek="2026-10-19" />)
  expect(await screen.findByText('my original note')).toBeInTheDocument()
  autoConfirm = false
  view.rerender(<TradeWorkspace mode="inbox" userId="other" initialWeek="2026-10-19" />)
  expect(screen.queryByText('my original note')).not.toBeInTheDocument()
  act(() => authChanged('INITIAL_SESSION', { user: { id: 'other' } }))
  expect(screen.queryByText('my original note')).not.toBeInTheDocument()
})

test('empty initial session waits for sign-in and rejects the earlier load', async () => {
  autoConfirm = false
  let complete!: (response: Response) => void
  fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { complete = resolve }))
    .mockResolvedValueOnce(Response.json({ trades: [] }))
  render(<TradeWorkspace mode="inbox" userId="owner" initialWeek="2026-10-19" />)
  act(() => authChanged('INITIAL_SESSION', { user: { id: 'owner' } }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  act(() => authChanged('INITIAL_SESSION', null))
  expect(screen.queryByText('my original note')).not.toBeInTheDocument()
  act(() => authChanged('SIGNED_IN', { user: { id: 'owner' } }))
  expect(await screen.findByText('All caught up. No trades are waiting for an exit.')).toBeInTheDocument()
  await act(async () => complete(Response.json({ trades: [trade] })))
  expect(screen.queryByText('my original note')).not.toBeInTheDocument()
})

test('inbox cards show saved details, exact risk and visible exits newest first', async () => {
  const newer = { ...trade, id: 'newer', symbol: 'NQ', side: 'short' as const, original_note: '  precise note\nkept', setup: 'Retest', entry_price: '100.000000000000001', stop_price: '100.000000000000002', opened_at: '2026-10-20T10:00:00Z' }
  fetchMock.mockResolvedValue(Response.json({ trades: [newer, trade] }))
  render(<TradeWorkspace mode="inbox" userId="owner" initialWeek="2026-10-19" />)
  expect(await screen.findByRole('heading', { name: 'Waiting for an exit (2)' })).toBeInTheDocument()
  const cards = screen.getAllByRole('article')
  expect(within(cards[0]).getByRole('heading', { name: 'NQ short' })).toBeInTheDocument()
  expect(cards[0].querySelector('.trade-note')?.textContent).toBe(newer.original_note)
  expect(within(cards[0]).getByText('Retest')).toBeVisible()
  expect(within(cards[0]).getByText('2026-10-20 10:00:00')).toBeVisible()
  expect(within(cards[0]).getByText('0.000000000000001')).toBeVisible()
  expect(within(cards[0]).getByText('Risk per unit')).toBeVisible()
  expect(within(cards[0]).getByLabelText('Exit price')).toBeVisible()
  expect(within(cards[0]).getByRole('button', { name: 'Save exit' })).toBeVisible()
  expect(within(cards[0]).getByRole('button', { name: 'Chart data' })).toBeVisible()
  expect(within(cards[0]).getByText('Correct trade details')).toBeVisible()
})

test('inline exit keeps failed input and waits for authorized refresh before removing its card', async () => {
  let refresh!: (response: Response) => void
  fetchMock.mockResolvedValueOnce(Response.json({ trades: [trade] }))
    .mockResolvedValueOnce(Response.json({ error: 'Retry saving.' }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ trade: { ...trade, exit_price: '12', r_result: '2' } }))
    .mockReturnValueOnce(new Promise<Response>(resolve => { refresh = resolve }))
  render(<TradeWorkspace mode="inbox" userId="owner" initialWeek="2026-10-19" />)
  await screen.findByText('my original note')
  await userEvent.type(screen.getByLabelText('Exit price'), '12')
  await userEvent.click(screen.getByRole('button', { name: 'Save exit' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Retry saving.')
  expect(screen.getByLabelText('Exit price')).toHaveValue('12')
  await userEvent.click(screen.getByRole('button', { name: 'Save exit' }))
  expect(await screen.findByText('ES: Win · +2.00R. Saved.')).toBeInTheDocument()
  expect(screen.getByText('my original note')).toBeInTheDocument()
  await act(async () => refresh(Response.json({ trades: [] })))
  expect(await screen.findByText('All caught up. No trades are waiting for an exit.')).toBeInTheDocument()
  expect(screen.queryByText('my original note')).not.toBeInTheDocument()
})

test('failed confirmation reload keeps the inbox card and offers retry', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ trades: [trade] }))
    .mockResolvedValueOnce(Response.json({ trade: { ...trade, exit_price: '12', r_result: '2' } }))
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(Response.json({ trades: [] }))
  render(<TradeWorkspace mode="inbox" userId="owner" initialWeek="2026-10-19" />)
  await screen.findByText('my original note')
  await userEvent.type(screen.getByLabelText('Exit price'), '12')
  await userEvent.click(screen.getByRole('button', { name: 'Save exit' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load trades')
  expect(screen.getByText('my original note')).toBeInTheDocument()
  expect(screen.getByLabelText('Exit price')).toHaveValue('12')
  expect(screen.queryByText('All caught up. No trades are waiting for an exit.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Retry loading' }))
  expect(await screen.findByText('All caught up. No trades are waiting for an exit.')).toBeInTheDocument()
})

test('account replacement hides loaded notes and ignores a pending inline exit', async () => {
  let complete!: (response: Response) => void
  fetchMock.mockResolvedValueOnce(Response.json({ trades: [trade] }))
    .mockReturnValueOnce(new Promise<Response>(resolve => { complete = resolve }))
  render(<TradeWorkspace mode="inbox" userId="owner" initialWeek="2026-10-19" />)
  await screen.findByText('my original note')
  await userEvent.type(screen.getByLabelText('Exit price'), '12')
  await userEvent.click(screen.getByRole('button', { name: 'Save exit' }))
  act(() => authChanged('SIGNED_IN', { user: { id: 'other' } }))
  expect(screen.queryByText('my original note')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Exit price')).not.toBeInTheDocument()
  await act(async () => complete(Response.json({ trade: { ...trade, exit_price: '12', r_result: '2' } })))
  expect(screen.getByRole('alert')).toHaveTextContent('Your session changed')
  expect(screen.queryByText(/Saved\./)).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('route owner replacement rejects a previous owners pending exit result', async () => {
  let complete!: (response: Response) => void
  fetchMock.mockResolvedValueOnce(Response.json({ trades: [trade] }))
    .mockReturnValueOnce(new Promise<Response>(resolve => { complete = resolve }))
    .mockResolvedValueOnce(Response.json({ trades: [] }))
  const view = render(<TradeWorkspace mode="inbox" userId="owner" initialWeek="2026-10-19" />)
  await screen.findByText('my original note')
  await userEvent.type(screen.getByLabelText('Exit price'), '12')
  await userEvent.click(screen.getByRole('button', { name: 'Save exit' }))
  autoConfirm = false
  view.rerender(<TradeWorkspace mode="inbox" userId="other" initialWeek="2026-10-19" />)
  act(() => authChanged('INITIAL_SESSION', { user: { id: 'other' } }))
  await screen.findByText('All caught up. No trades are waiting for an exit.')
  await act(async () => complete(Response.json({ trade: { ...trade, exit_price: '12', r_result: '2' } })))
  expect(screen.queryByText(/ES:.*Saved\./)).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(3)
})

test('route owner replacement clears previous trade feedback', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ trades: [trade] }))
    .mockResolvedValueOnce(Response.json({ trade: { ...trade, exit_price: '12', r_result: '2' } }))
    .mockResolvedValueOnce(Response.json({ trades: [] }))
    .mockResolvedValueOnce(Response.json({ trades: [] }))
  const view = render(<TradeWorkspace mode="inbox" userId="owner" initialWeek="2026-10-19" />)
  await screen.findByText('my original note')
  await userEvent.type(screen.getByLabelText('Exit price'), '12')
  await userEvent.click(screen.getByRole('button', { name: 'Save exit' }))
  expect(await screen.findByText('ES: Win · +2.00R. Saved.')).toBeInTheDocument()
  autoConfirm = false
  view.rerender(<TradeWorkspace mode="inbox" userId="other" initialWeek="2026-10-19" />)
  act(() => authChanged('INITIAL_SESSION', { user: { id: 'other' } }))
  await screen.findByText('All caught up. No trades are waiting for an exit.')
  expect(screen.queryByText(/ES:.*Saved\./)).not.toBeInTheDocument()
})
