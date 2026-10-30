'use client'

import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import type { ImportedTrade } from '../../lib/trades/tradingview-history'
import TradeEditForm, { resultLabel, type SavedTrade } from './trade-edit-form'

export default function TradingViewHistoryImport({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const id = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const generation = useRef(0)
  const owner = useRef<string | null>(null)
  const busy = useRef(false)
  const [readyOwner, setReadyOwner] = useState<string | null>(null)
  const [csv, setCsv] = useState('')
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [confirmed, setConfirmed] = useState(false)
  const [trades, setTrades] = useState<ImportedTrade[] | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [savedTrades, setSavedTrades] = useState<SavedTrade[]>([])

  const clear = useCallback(() => {
    generation.current++
    busy.current = false
    setSavedTrades([]); setPending(false); setCsv(''); setTrades(null); setConfirmed(false); setError(''); setMessage('')
    if (fileInput.current) fileInput.current.value = ''
  }, [])
  useEffect(() => {
    let active = true
    owner.current = null
    const { data: { subscription } } = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event !== 'SIGNED_OUT' && session?.user.id === userId) {
        if (owner.current !== userId) clear()
        owner.current = userId; setReadyOwner(userId)
      } else {
        owner.current = null; setReadyOwner(null); clear()
        if (event === 'SIGNED_OUT' || session?.user.id !== undefined) active = false
      }
    })
    return () => { active = false; owner.current = null; clear(); subscription.unsubscribe() }
  }, [userId, clear])

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    generation.current++
    const current = generation.current
    setCsv(''); setTrades(null); setConfirmed(false); setError(''); setMessage(''); setSavedTrades([])
    if (!file) return
    if (file.size > 2_000_000) { setError('CSV must be at most 2 MB.'); return }
    try {
      const content = await file.text()
      if (current === generation.current && owner.current === userId) setCsv(content)
    } catch { if (current === generation.current && owner.current === userId) setError('Could not read the file. Select it again.') }
  }
  async function submit(commit: boolean) {
    if (busy.current || owner.current !== userId || !csv || (commit && (!confirmed || !trades))) return
    const current = generation.current
    busy.current = true; setPending(true); setError(''); setMessage('')
    if (!commit) { setTrades(null); setConfirmed(false) }
    try {
      const response = await fetch('/api/trades/import/tradingview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv, timeZone, commit }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not import the CSV. Retry.')
      if (current !== generation.current || owner.current !== userId) return
      if (commit) {
        if (!Number.isInteger(body.inserted) || !Number.isInteger(body.alreadyPresent) || body.inserted < 0 || body.alreadyPresent < 0 || body.inserted + body.alreadyPresent !== trades!.length || !Array.isArray(body.trades) || body.trades.length !== trades!.length) throw new Error('Could not confirm the import was saved. Retry saving.')
        clear(); setSavedTrades(body.trades); setMessage(`Saved ${body.inserted} trades. ${body.alreadyPresent} already present.`); onSaved()
      } else {
        if (!Array.isArray(body.trades) || !body.trades.length) throw new Error('Could not preview the trades. Retry.')
        setTrades(body.trades)
      }
    } catch (cause) { if (current === generation.current && owner.current === userId) setError(cause instanceof Error ? cause.message : 'Could not import the CSV. Retry.') }
    finally { if (current === generation.current) { busy.current = false; setPending(false) } }
  }
  if (readyOwner !== userId) return null
  return <section className="history-import" aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`}>Import TradingView history</h2>
    <p>Upload a paper-trading history CSV with paired entry and exit rows. Your trades stay private.</p>
    <fieldset disabled={pending}>
      <label htmlFor={`${id}-file`}>TradingView history CSV</label>
      <input ref={fileInput} id={`${id}-file`} type="file" accept=".csv,text/csv" onChange={chooseFile} aria-describedby={error ? `${id}-error` : undefined} />
      <label htmlFor={`${id}-timezone`}>Export timezone</label>
      <input id={`${id}-timezone`} value={timeZone} onChange={event => { setTimeZone(event.target.value); setTrades(null); setConfirmed(false); setError('') }} aria-describedby={`${id}-timezone-help`} />
      <p id={`${id}-timezone-help`}>The CSV has no timezone. Confirm the timezone used in TradingView; it determines the opening week.</p>
      <button type="button" disabled={!csv} onClick={() => void submit(false)}>Preview trades</button>
      {trades && <>
        <h3>{trades.length} closed trades ready to import.</h3>
        <div className="history-preview"><table><caption>Opening times resolved using {timeZone}</caption><thead><tr><th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th>Opened (UTC)</th><th>Source-reported net P&amp;L (USD)</th></tr></thead><tbody>{trades.map(trade => <tr key={trade.sourceKey}><td>{trade.symbol}</td><td>{trade.side}</td><td>{trade.entryPrice}</td><td>{trade.exitPrice}</td><td>{trade.openedAt.replace('T', ' ').slice(0, 19)} UTC</td><td>{trade.sourcePnlUsd}</td></tr>)}</tbody></table></div>
        <p role="alert">{trades.length} trades lack an initial stop and setup. Notes are also missing. R, R-based charts and totals, and setup analysis will be incomplete. Edit these details after saving.</p>
        <label className="confirmation"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I confirm this is the timezone used by the export</label>
        <button type="button" disabled={!confirmed} onClick={() => void submit(true)}>Continue</button>
      </>}
      {csv && <button type="button" onClick={clear}>Cancel</button>}
    </fieldset>
    {pending && <p role="status">{trades ? 'Saving trades…' : 'Reading trades…'}</p>}
    {error && <p id={`${id}-error`} role="alert" className="error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {savedTrades.length > 0 && <section aria-label="Imported trades" className="history-saved"><h3>Imported trades</h3>{savedTrades.map(trade => <article key={trade.id}>
      <h4>{trade.symbol} · {trade.side}</h4>
      <p>Opened (UTC): {trade.opened_at.replace('T', ' ').slice(0, 19)} · {resultLabel(trade.r_result, trade.exit_price)}</p>
      <p>{[!trade.original_note && 'Missing note', !trade.stop_price && 'Missing initial stop', !trade.setup && 'Missing setup'].filter(Boolean).join(' · ')}</p>
      <p>Source-reported net P&amp;L: {trade.source_net_pnl_usd} USD</p>
      <details><summary>Edit details</summary><TradeEditForm key={JSON.stringify(trade)} trade={trade} onSaved={updated => {
        if (owner.current !== userId) return
        setSavedTrades(previous => previous.map(item => item.id === updated.id ? updated : item)); onSaved()
      }} /></details>
    </article>)}</section>}
  </section>
}
