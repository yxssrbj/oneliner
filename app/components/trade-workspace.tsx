'use client'

import { useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { summarizeTrades } from '../../lib/trades/summary'
import { nextWeekStartUtc } from '../../lib/trades/week'
import ExitForm from './exit-form'
import TradeEditForm, { resultLabel, type SavedTrade } from './trade-edit-form'

type Summary = ReturnType<typeof summarizeTrades>
type Loaded = { key: string; trades: SavedTrade[]; summary?: Summary; error?: string }

function TradeCard({ trade, onSaved }: { trade: SavedTrade; onSaved: (trade: SavedTrade) => void }) {
  return <article className="trade-card">
    <div className="trade-card-heading"><h3>{trade.symbol} <span>{trade.side}</span></h3><span className={trade.r_result === null ? 'outcome-pending' : Number(trade.r_result) > 0 ? 'outcome-win' : Number(trade.r_result) < 0 ? 'outcome-loss' : ''}>{resultLabel(trade.r_result)}</span></div>
    <p className="trade-note">{trade.original_note}</p>
    <dl className="trade-details"><div><dt>Entry</dt><dd>{trade.entry_price}</dd></div><div><dt>Initial stop</dt><dd>{trade.stop_price}</dd></div><div><dt>Setup</dt><dd>{trade.setup}</dd></div><div><dt>Opened (UTC)</dt><dd>{new Date(trade.opened_at).toISOString().replace('T', ' ').slice(0, 19)}</dd></div>{trade.exit_price !== null && <div><dt>Exit</dt><dd>{trade.exit_price}</dd></div>}</dl>
    <details><summary>{trade.exit_price === null ? 'Add exit' : 'Correct exit'}</summary><ExitForm key={trade.exit_price} trade={trade} onSaved={onSaved} /></details>
    <details><summary>Correct trade details</summary><TradeEditForm key={JSON.stringify(trade)} trade={trade} onSaved={onSaved} /></details>
  </article>
}

export default function TradeWorkspace({ mode, userId, initialWeek }: { mode: 'inbox' | 'review'; userId: string; initialWeek: string }) {
  const [week, setWeek] = useState(initialWeek)
  const [revision, setRevision] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [message, setMessage] = useState('')
  const [sessionChanged, setSessionChanged] = useState(false)
  const signedOut = useRef(false)
  const url = mode === 'inbox' ? '/api/trades?status=open' : `/api/trades?weekStart=${week}`
  const key = `${url}:${revision}`
  useEffect(() => {
    const { data: { subscription } } = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (session && session.user.id !== userId)) {
        signedOut.current = true; setSessionChanged(true); setLoaded(null); setMessage('')
      }
    })
    return () => subscription.unsubscribe()
  }, [userId])
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch(url, { cache: 'no-store' })
        const body = await response.json()
        if (!response.ok || !Array.isArray(body.trades)) throw new Error(body.error || 'Could not load trades.')
        if (active && !signedOut.current) setLoaded({ key, trades: body.trades, summary: body.summary })
      } catch {
        if (active && !signedOut.current) setLoaded({ key, trades: [], error: 'Could not load trades. Retry loading.' })
      }
    }
    void load()
    return () => { active = false }
  }, [key, url])
  function saved(trade: SavedTrade) {
    if (signedOut.current) return
    setMessage(`${trade.symbol}: ${resultLabel(trade.r_result)}. Saved.`)
    setRevision(value => value + 1)
  }
  if (sessionChanged) return <p role="alert">Your session changed. Reload this page to continue.</p>
  const current = loaded?.key === key ? loaded : null
  const trades = current?.trades ?? []
  const pending = trades.filter(trade => trade.exit_price === null)
  const summary = current?.summary
  function moveWeek(days: number) {
    const date = new Date(`${week}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    setWeek(date.toISOString().slice(0, 10)); setMessage('')
  }
  return <div className="trade-workspace">
    {mode === 'review' ? <>
      <p>Your opening week, Monday to Sunday in UTC. Late exits update the week the trade opened.</p>
      <div className="week-picker"><button onClick={() => moveWeek(-7)} aria-label="Previous week">← Previous</button><strong>Week of {week}</strong><button onClick={() => moveWeek(7)} aria-label="Next week">Next →</button></div>
      <p className="week-range">{week} 00:00 UTC – {nextWeekStartUtc(week)} 00:00 UTC (exclusive)</p>
    </> : <p>Finish the trades waiting for an exit. Your original notes and initial stops stay close at hand.</p>}
    {message && <p role="status" className="save-message">{message}</p>}
    {!current ? <p role="status">Loading trades…</p> : current.error ? <div><p role="alert" className="error">{current.error}</p><button onClick={() => setRevision(value => value + 1)}>Retry loading</button></div> : <>
      {mode === 'review' && summary && <>
        <dl className="week-metrics"><div><dt>Total R</dt><dd>{summary.totalR > 0 ? '+' : ''}{summary.totalR.toFixed(2)}R</dd></div><div><dt>Win rate</dt><dd>{summary.winRate === null ? 'Unavailable' : `${(summary.winRate * 100).toFixed(1)}%`}</dd></div><div><dt>Completed</dt><dd>{summary.completedCount}</dd></div><div><dt>Unfinished</dt><dd>{summary.unfinishedCount}</dd></div></dl>
        <section><h2>Daily breakdown</h2><div className="daily-table"><table aria-label="Daily breakdown in UTC"><thead><tr><th scope="col">Day (UTC)</th><th scope="col">Completed</th><th scope="col">Pending</th><th scope="col">Total R</th></tr></thead><tbody>{Array.from({ length: 7 }, (_, day) => {
          const date = new Date(`${week}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + day)
          const daily = summarizeTrades(trades.filter(trade => trade.opened_at.slice(0, 10) === date.toISOString().slice(0, 10)).map(trade => ({ r_result: trade.r_result === null ? null : Number(trade.r_result) })))
          return <tr key={day}><th scope="row">{date.toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })}</th><td>{daily.completedCount}</td><td>{daily.unfinishedCount}</td><td>{daily.totalR.toFixed(2)}R</td></tr>
        })}</tbody></table></div></section>
      </>}
      <section><h2>{mode === 'inbox' ? `Waiting for an exit (${pending.length})` : 'Pending outcomes'}</h2>{pending.length ? <div className="trade-list">{pending.map(trade => <TradeCard key={trade.id} trade={trade} onSaved={saved} />)}</div> : <p>{mode === 'inbox' ? 'All caught up. No trades are waiting for an exit.' : 'No pending outcomes this week.'}</p>}</section>
      {mode === 'review' && <section><h2>Trades opened this week</h2>{trades.length ? <div className="trade-list">{trades.map(trade => <TradeCard key={trade.id} trade={trade} onSaved={saved} />)}</div> : <p>No trades opened this week.</p>}</section>}
    </>}
  </div>
}
