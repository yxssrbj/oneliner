'use client'

import { useId, useState, type ChangeEvent } from 'react'
import { parseTradingViewChartCsv, type ChartBar } from '../../lib/trades/chart-csv'

function ClosePriceChart({ bars }: { bars: ChartBar[] }) {
  const closes = bars.map(bar => bar.close)
  const min = Math.min(...closes), max = Math.max(...closes), range = max - min || 1
  const points = bars.map((bar, index) => {
    const x = bars.length === 1 ? 300 : 12 + (index / (bars.length - 1)) * 576
    const y = 12 + ((max - bar.close) / range) * 136
    return `${x},${y}`
  }).join(' ')
  return <svg className="chart-data-plot" viewBox="0 0 600 160" role="img" aria-label={`Close price chart for ${bars.length} bars`}>
    <line x1="12" y1="148" x2="588" y2="148" />
    <polyline points={points} />
  </svg>
}

export default function ChartDataImport({ tradeId }: { tradeId: string }) {
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedBars, setSavedBars] = useState<ChartBar[] | null>(null)
  const [previewBars, setPreviewBars] = useState<ChartBar[] | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadSavedChart() {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/trades/${tradeId}/chart-data`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not load chart data.')
      setSavedBars(body.chartData)
      setLoaded(true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load chart data.') }
    finally { setLoading(false) }
  }

  function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (!loaded && !loading) void loadSavedChart()
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    setPreviewBars(null); setMessage(''); setError('')
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Choose a CSV file.')
      if (file.size > 2_000_000) throw new Error('CSV must be smaller than 2 MB.')
      setPreviewBars(parseTradingViewChartCsv(await file.text()))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not read this CSV.') }
  }

  async function save() {
    if (!previewBars) return
    if (savedBars && !window.confirm('Replace the chart data attached to this trade?')) return
    setSaving(true); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/trades/${tradeId}/chart-data`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chartData: previewBars }) })
      const body = await response.json()
      if (!response.ok || !Array.isArray(body.chartData)) throw new Error(body.error || 'Could not save chart data. Your import is kept; retry saving.')
      setSavedBars(body.chartData); setLoaded(true); setMessage('Chart data saved.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save chart data. Your import is kept; retry saving.') }
    finally { setSaving(false) }
  }

  const visibleBars = previewBars ?? savedBars
  return <div className="chart-data-import">
    <button type="button" className="chart-data-toggle" aria-expanded={open} onClick={toggle}>Chart data</button>
    {open && <div className="chart-data-panel">
      <p>Import a TradingView chart-data CSV. Time and OHLC are required; volume is optional. Extra indicator columns are ignored.</p>
      <label htmlFor={inputId}>TradingView chart-data CSV</label>
      <input id={inputId} type="file" accept=".csv,text/csv" onChange={chooseFile} />
      {loading && <p role="status">Loading saved chart…</p>}
      {visibleBars && <>
        <p>{previewBars ? `Preview: ${previewBars.length} bars` : `Saved chart: ${savedBars?.length ?? 0} bars`}</p>
        <ClosePriceChart bars={visibleBars} />
        <p className="chart-data-range">{visibleBars[0].time} — {visibleBars.at(-1)!.time}</p>
      </>}
      {message && <p role="status" className="save-message">{message}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {previewBars && <button type="button" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save chart data'}</button>}
    </div>}
  </div>
}
