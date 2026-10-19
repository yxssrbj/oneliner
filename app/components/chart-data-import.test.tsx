// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import ChartDataImport from './chart-data-import'

const tradeId = '00000000-0000-4000-8000-000000000001'
const bars = [
  { time: '2026-10-19T09:30:00.000Z', open: 101, high: 104, low: 100, close: 103, volume: 25 },
  { time: '2026-10-19T09:31:00.000Z', open: 103, high: 105, low: 102, close: 104, volume: 30 },
]
const fetchMock = vi.fn()

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test('previews a TradingView CSV and saves its OHLCV bars to the selected trade', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ chartData: null })).mockResolvedValueOnce(Response.json({ chartData: bars }))
  render(<ChartDataImport tradeId={tradeId} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Chart data' }))
  await user.upload(screen.getByLabelText('TradingView chart-data CSV'), new File([
    'time,open,high,low,close,Volume,RSI\n2026-10-19T09:31:00Z,103,105,102,104,30,62\n2026-10-19T09:30:00Z,101,104,100,103,25,57',
  ], 'es-chart.csv', { type: 'text/csv' }))

  expect(await screen.findByText('Preview: 2 bars')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Close price chart for 2 bars' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save chart data' }))

  await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(`/api/trades/${tradeId}/chart-data`, expect.objectContaining({ method: 'PUT' })))
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ chartData: bars })
  expect(await screen.findByText('Chart data saved.')).toBeInTheDocument()
})

test('keeps an invalid CSV in preview and does not write it', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ chartData: null }))
  render(<ChartDataImport tradeId={tradeId} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Chart data' }))
  await user.upload(screen.getByLabelText('TradingView chart-data CSV'), new File(['symbol,price\nES,100'], 'invalid.csv', { type: 'text/csv' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('CSV must include time, open, high, low, and close columns.')
  expect(screen.queryByRole('button', { name: 'Save chart data' })).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('asks before replacing a chart already saved to the trade', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ chartData: bars }))
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<ChartDataImport tradeId={tradeId} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Chart data' }))
  await screen.findByRole('img', { name: 'Close price chart for 2 bars' })
  await user.upload(screen.getByLabelText('TradingView chart-data CSV'), new File([
    'time,open,high,low,close\n2026-10-19T09:32:00Z,104,106,103,105',
  ], 'later.csv', { type: 'text/csv' }))
  await user.click(screen.getByRole('button', { name: 'Save chart data' }))

  expect(confirm).toHaveBeenCalledWith('Replace the chart data attached to this trade?')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
