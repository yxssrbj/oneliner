'use client'

import { useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { priceRisk } from '../../lib/trades/validation'
import { nextWeekStartUtc } from '../../lib/trades/week'
import { demoTradesForWeek } from '../../lib/trades/demo'
import ExitForm from './exit-form'
import TradeEditForm, { resultLabel, type SavedTrade } from './trade-edit-form'
import ChartDataImport from './chart-data-import'
import WeeklyReview from './weekly-review'

type Loaded = { key: string; trades: SavedTrade[]; error?: string }

function TradeCard({ trade, onSaved, readOnly = false, compact = false }: { trade: SavedTrade; onSaved: (trade: SavedTrade) => void; readOnly?: boolean; compact?: boolean }) {
  return <article className={compact ? 'trade-card unfinished-card' : 'trade-card'}>
    <div className="trade-card-heading"><h3>{trade.symbol} <span>{trade.side}</span></h3>{compact ? <span className="trade-setup">{trade.setup}</span> : <span className={trade.r_result === null ? 'outcome-pending' : Number(trade.r_result) > 0 ? 'outcome-win' : Number(trade.r_result) < 0 ? 'outcome-loss' : ''}>{resultLabel(trade.r_result)}</span>}</div>
    {compact && <p className="trade-opened">Opened (UTC) · <time dateTime={trade.opened_at}>{new Date(trade.opened_at).toISOString().replace('T', ' ').slice(0, 19)}</time></p>}
    <p className="trade-note">{trade.original_note}</p>
    <div className={compact ? 'unfinished-entry' : undefined}>
      <dl className="trade-details"><div><dt>Entry</dt><dd>{trade.entry_price}</dd></div><div><dt>Initial stop</dt><dd>{trade.stop_price}</dd></div>{compact ? <div><dt>Risk per unit</dt><dd>{priceRisk(trade.entry_price, trade.stop_price)}</dd></div> : <><div><dt>Setup</dt><dd>{trade.setup}</dd></div><div><dt>Opened (UTC)</dt><dd>{new Date(trade.opened_at).toISOString().replace('T', ' ').slice(0, 19)}</dd></div></>}{trade.exit_price !== null && <div><dt>Exit</dt><dd>{trade.exit_price}</dd></div>}</dl>
      {!readOnly && compact && <ExitForm key={trade.exit_price} trade={trade} onSaved={onSaved} />}
    </div>
    {!readOnly && <>{!compact && <details><summary>{trade.exit_price === null ? 'Add exit' : 'Correct exit'}</summary><ExitForm key={trade.exit_price} trade={trade} onSaved={onSaved} /></details>}
    <ChartDataImport tradeId={trade.id} />
    <details><summary>Correct trade details</summary><TradeEditForm key={JSON.stringify(trade)} trade={trade} onSaved={onSaved} /></details></>}
  </article>
}

export default function TradeWorkspace({ mode, userId, initialWeek, demo = false }: { mode: 'inbox' | 'review'; userId: string; initialWeek: string; demo?: boolean }) {
  const [week, setWeek] = useState(initialWeek)
  const [revision, setRevision] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [message, setMessage] = useState<{ owner: string; text: string } | null>(null)
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null)
  const [sessionChanged, setSessionChanged] = useState(false)
  const [confirmedOwner, setConfirmedOwner] = useState<string | null>(null)
  const ownerReady = confirmedOwner === userId
  const routeOwner = useRef(userId)
  const signedOut = useRef(true)
  const generation = useRef(0)
  const url = mode === 'inbox' ? '/api/trades?status=open' : `/api/trades?weekStart=${week}`
  const dataKey = `${userId}:${url}`
  const key = mode === 'inbox' ? dataKey : `${dataKey}:${revision}`
  const demoTrades = demo ? demoTradesForWeek(week, initialWeek) : []
  useEffect(() => {
    if (demo) return
    let active = true
    routeOwner.current = userId
    signedOut.current = true
    generation.current += 1
    const { data: { subscription } } = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event !== 'SIGNED_OUT' && session?.user.id === userId) {
        if (signedOut.current) generation.current += 1
        signedOut.current = false; setConfirmedOwner(userId)
      } else {
        generation.current += 1
        if (event === 'SIGNED_OUT' || session?.user.id !== undefined) active = false
        signedOut.current = true; setSessionChanged(!active); setLoaded(null); setMessage(null)
        setConfirmedOwner(null)
      }
    })
    return () => { active = false; generation.current += 1; signedOut.current = true; setConfirmedOwner(null); subscription.unsubscribe() }
  }, [userId, demo])
  useEffect(() => {
    let active = true
    if (demo || !ownerReady) return
    const requestGeneration = generation.current
    async function load() {
      try {
        const response = await fetch(url, { cache: 'no-store' })
        const body = await response.json()
        if (!response.ok || !Array.isArray(body.trades)) throw new Error(body.error || 'Could not load trades.')
        if (active && !signedOut.current && requestGeneration === generation.current) setLoaded({ key, trades: body.trades })
      } catch {
        if (active && !signedOut.current && requestGeneration === generation.current) setLoaded(previous => ({ key, trades: mode === 'inbox' && previous?.key === key ? previous.trades : [], error: 'Could not load trades. Retry loading.' }))
      }
    }
    void load()
    return () => { active = false }
  }, [demo, key, mode, ownerReady, revision, url, week])
  function saved(trade: SavedTrade) {
    if (signedOut.current || !ownerReady || routeOwner.current !== userId) return
    setMessage({ owner: userId, text: `${trade.symbol}: ${resultLabel(trade.r_result)}. Saved.` })
    setRevision(value => value + 1)
  }
  if (sessionChanged) return <p role="alert">Your session changed. Reload this page to continue.</p>
  if (!demo && !ownerReady) return <p role="status">Loading trades…</p>
  const current = demo ? { key, trades: demoTrades } : loaded?.key === key ? loaded : null
  const trades = current?.trades ?? []
  const pending = trades.filter(trade => trade.exit_price === null)
  function moveWeek(days: number) {
    const date = new Date(`${week}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    setWeek(date.toISOString().slice(0, 10)); setMessage(null); setSelectedTradeId(null)
  }
  return <div className={mode === 'inbox' ? 'trade-workspace unfinished-workspace' : 'trade-workspace review-workspace'}>
    {demo && <p role="note">Demo preview — sample data only. Nothing is saved.</p>}
    {mode === 'review' ? <>
      <div className="review-page-heading"><div><span className="review-eyebrow">The bigger picture</span><h1>Your week, in perspective.</h1><p>Make sense of the trades. Take something into next week.</p></div>
      <div className="week-picker"><button onClick={() => moveWeek(-7)} aria-label="Previous week">‹</button><strong>Week of {week}</strong><button onClick={() => moveWeek(7)} aria-label="Next week">›</button></div></div>
      <p className="week-range">{week} 00:00 UTC – {nextWeekStartUtc(week)} 00:00 UTC (exclusive)</p>
    </> : <p>Finish the trades waiting for an exit. Your original notes and initial stops stay close at hand.</p>}
    {message?.owner === userId && <p role="status" className="save-message">{message.text}</p>}
    {!current ? <p role="status">Loading trades…</p> : current.error && <div><p role="alert" className="error">{current.error}</p><button onClick={() => setRevision(value => value + 1)}>Retry loading</button></div>}
    {current && (!current.error || (mode === 'inbox' && trades.length > 0)) && <>
      {mode === 'review' ? <><WeeklyReview week={week} trades={trades} onSelect={setSelectedTradeId} />{selectedTradeId && trades.find(trade => trade.id === selectedTradeId) && <section className="review-selected"><h2>Trade details</h2><TradeCard key={selectedTradeId} trade={trades.find(trade => trade.id === selectedTradeId)!} onSaved={saved} readOnly={demo} /></section>}</> : <section><h2>Waiting for an exit ({pending.length})</h2>{pending.length ? <div className="trade-list">{pending.map(trade => <TradeCard key={trade.id} trade={trade} onSaved={saved} readOnly={demo} compact />)}</div> : <p>All caught up. No trades are waiting for an exit.</p>}</section>}
    </>}
  </div>
}
