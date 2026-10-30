// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import WeeklyReview from './weekly-review'

const trade = { id: 'import', symbol: 'ES', side: 'long' as const, original_note: '', setup: '', entry_price: '100', stop_price: '', exit_price: '102', r_result: null, opened_at: '2026-10-19T10:00:00Z', source_net_pnl_usd: '-5' }
afterEach(cleanup)
test('closed import needs details and reports loss without pretending it needs an exit', () => {
  render(<WeeklyReview week="2026-10-19" trades={[trade]} onSelect={vi.fn()} />)
  expect(screen.getByText('Needs details')).toBeVisible()
  expect(screen.queryByText('Needs exit')).not.toBeInTheDocument()
  expect(screen.getByText(/0 wins · 1 loss · 0 flat/)).toBeVisible()
  expect(screen.getAllByText('Unclassified').length).toBeGreaterThan(0)
  expect(screen.getByText(/1 closed trade missing R/)).toBeVisible()
  expect(screen.queryByRole('link', {name: /Finish/})).not.toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})
test('known R is explicitly partial across metrics chart days and setups', () => {
  render(<WeeklyReview week="2026-10-19" trades={[trade, {...trade, id:'known', r_result:'2', stop_price:'99'}]} onSelect={vi.fn()} />)
  expect(screen.getByRole('img', {name: /partial/i})).toBeVisible()
  expect(screen.getAllByText(/partial/i).length).toBeGreaterThanOrEqual(6)
  expect(screen.getByText(/0 wins · 2 losses · 0 flat/)).toBeVisible()
})
test('closed trade with known R still needs its missing setup', () => {
  render(<WeeklyReview week="2026-10-19" trades={[{...trade, r_result:'2', stop_price:'99'}]} onSelect={vi.fn()} />)
  expect(screen.getByRole('table')).toHaveTextContent('+2.00R · Needs details')
  expect(screen.queryByText(/closed trade missing R/)).not.toBeInTheDocument()
})
