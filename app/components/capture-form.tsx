'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { normalizeSuggestion } from '../../lib/trades/parse-schema'
import { validateDraft, validateNote, type TradeDraft } from '../../lib/trades/validation'
import { resultLabel, type SavedTrade } from './trade-edit-form'
import './capture-form.css'

function emptyDraft(): TradeDraft {
  const now = new Date()
  return { originalNote: '', symbol: '', side: '', entryPrice: '', stopPrice: '', setup: '', openedAt: new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
}

export default function CaptureForm({ userId }: { userId: string }) {
  const storageKey = `oneliner:capture:${userId}`
  const [detailsVisible, setDetailsVisible] = useState(false)
  const [recent, setRecent] = useState<{ owner: string; trades: SavedTrade[]; error?: string } | null>(null)
  const [recentRevision, setRecentRevision] = useState(0)
  const [draft, setDraft] = useState<TradeDraft | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [pending, setPending] = useState<'parse' | 'save' | null>(null)
  const [error, setError] = useState('')
  const [clarifications, setClarifications] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [loggedOut, setLoggedOut] = useState(false)
  const [confirmedOwner, setConfirmedOwner] = useState<string | null>(null)
  const ownerReady = confirmedOwner === userId
  const [storageWarning, setStorageWarning] = useState(false)
  const busy = useRef(false)
  const signedOut = useRef(false)
  const generation = useRef(0)

  useEffect(() => {
    generation.current += 1
    signedOut.current = true
    let active = true
    let restored = emptyDraft(), key = crypto.randomUUID()
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null')
      if (stored?.draft && Object.keys(restored).every((field) => typeof stored.draft[field] === 'string') && typeof stored.idempotencyKey === 'string') {
        restored = stored.draft; key = stored.idempotencyKey
      }
    } catch { /* An unreadable draft must not prevent manual capture. */ }
    // Restore browser-only storage after hydration, before enabling the form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(restored)
    setDetailsVisible(Boolean(restored.symbol || restored.side || restored.entryPrice || restored.stopPrice || restored.exitPrice || restored.setup))
    setRecent(null)
    setIdempotencyKey(key)
    const { data: { subscription } } = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event !== 'SIGNED_OUT' && session?.user.id === userId) {
        signedOut.current = false
        setConfirmedOwner(userId)
      } else {
        generation.current += 1
        signedOut.current = true
        setConfirmedOwner(null)
        setRecent(null)
        busy.current = false
        setPending(null)
        if (event === 'SIGNED_OUT' || session?.user.id !== undefined) {
          active = false
          setLoggedOut(true)
          try { sessionStorage.removeItem(storageKey) } catch { /* Storage may be unavailable. */ }
          setDraft(null)
        }
      }
    })
    return () => { active = false; generation.current += 1; signedOut.current = true; setConfirmedOwner(null); busy.current = false; setPending(null); subscription.unsubscribe() }
  }, [storageKey, userId])

  useEffect(() => {
    if (!ownerReady || signedOut.current) return
    let active = true
    const requestGeneration = generation.current
    setRecent(null)
    async function loadRecent() {
      try {
        const response = await fetch('/api/trades?recent=3', { cache: 'no-store' })
        const result = await response.json()
        if (!response.ok || !Array.isArray(result.trades)) throw new Error(result.error || 'Could not load recent trades.')
        if (active && !signedOut.current && requestGeneration === generation.current) setRecent({ owner: userId, trades: result.trades })
      } catch (cause) {
        if (active && !signedOut.current && requestGeneration === generation.current) setRecent({ owner: userId, trades: [], error: cause instanceof Error ? cause.message : 'Could not load recent trades.' })
      }
    }
    void loadRecent()
    return () => { active = false }
  }, [ownerReady, userId, recentRevision])

  function persist(next: TradeDraft, key = idempotencyKey) {
    setDraft(next); setSaved(false)
    try { sessionStorage.setItem(storageKey, JSON.stringify({ draft: next, idempotencyKey: key })) }
    catch { setStorageWarning(true) }
  }
  function change(field: keyof TradeDraft, value: string) {
    if (!draft || signedOut.current || !ownerReady) return
    persist({ ...draft, [field]: value })
    setError('')
  }
  async function suggest() {
    if (!draft || busy.current || signedOut.current || !ownerReady) return
    const noteError = validateNote(draft.originalNote)
    if (noteError) { setError(noteError); return }
    setDetailsVisible(true)
    busy.current = true; setPending('parse'); setError(''); setClarifications([])
    const requestGeneration = generation.current
    try {
      const response = await fetch('/api/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: draft.originalNote }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Parsing unavailable. Enter the fields manually.')
      const suggestion = normalizeSuggestion(result.suggestion)
      if (signedOut.current || requestGeneration !== generation.current) return
      persist({ ...draft, symbol: suggestion.symbol ?? '', side: suggestion.side ?? '', entryPrice: suggestion.entryPrice ?? '', stopPrice: suggestion.stopPrice ?? '', setup: suggestion.setup ?? '' })
      setClarifications(suggestion.clarifications)
    } catch (cause) { if (!signedOut.current && requestGeneration === generation.current) setError(cause instanceof Error ? cause.message : 'Parsing unavailable. Enter the fields manually.') }
    finally { if (requestGeneration === generation.current) { busy.current = false; setPending(null) } }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || busy.current || signedOut.current || !ownerReady) return
    const date = new Date(draft.openedAt)
    const validated = validateDraft({ ...draft, openedAt: Number.isFinite(date.getTime()) ? date.toISOString() : '' })
    if (validated.error) { setError(validated.error); return }
    busy.current = true; setPending('save'); setError('')
    const requestGeneration = generation.current
    try {
      const response = await fetch('/api/trades', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(validated.value) })
      const result = await response.json()
      if (!response.ok || !result.trade?.id) throw new Error(result.error || 'Could not confirm the trade was saved. Your draft is kept; retry saving.')
      if (signedOut.current || requestGeneration !== generation.current) return
      try { sessionStorage.removeItem(storageKey) } catch { setStorageWarning(true) }
      setDraft(emptyDraft()); setIdempotencyKey(crypto.randomUUID()); setClarifications([]); setSaved(true); setDetailsVisible(false); setRecentRevision(value => value + 1)
    } catch (cause) { if (!signedOut.current && requestGeneration === generation.current) setError(cause instanceof Error ? cause.message : 'Could not confirm the trade was saved. Your draft is kept; retry saving.') }
    finally { if (requestGeneration === generation.current) { busy.current = false; setPending(null) } }
  }

  if (!draft || !ownerReady) return <p>{loggedOut ? 'Your session changed. Reload this page to continue.' : 'Loading your draft…'}</p>
  return <div className="capture-layout"><form onSubmit={save} className="capture-form">
    <h2 className="capture-step"><span>1</span> Write it as it happened.</h2>
    <p className="capture-intro">A few words now. A clearer picture later.</p>
    {saved && <p role="status" className="capture-success">Trade saved.</p>}
    {storageWarning && <p role="status">This browser could not store your draft. Keep this tab open until the trade is saved.</p>}
    <fieldset disabled={pending !== null}>
      <label htmlFor="trade-note">Trade note</label>
      <textarea id="trade-note" value={draft.originalNote} onChange={(event) => change('originalNote', event.target.value)} maxLength={1000} required rows={6} placeholder="CL short 87.64, stop 87.90, opening range breakout" aria-describedby="parse-disclosure" />
      <p id="parse-disclosure" className="capture-hint">Suggest fields sends this note to OpenAI. Suggestions can be wrong; review every field. You can also enter the details yourself.</p>
      <button type="button" className="secondary-button" onClick={suggest}>{pending === 'parse' ? 'Reading note…' : 'Suggest fields'}</button>
      <button type="button" className="manual-button" onClick={() => setDetailsVisible(true)} aria-expanded={detailsVisible} aria-controls="capture-details">Enter details manually</button>
      <div id="capture-details" hidden={!detailsVisible} className="capture-review">
      <h2 className="capture-step"><span>2</span> Review trade details</h2>
      {clarifications.length > 0 && <ul className="capture-clarifications" aria-label="Needs clarification">{Array.from(new Set(clarifications)).map((item) => <li key={item}>{item}</li>)}</ul>}
      <div className="capture-grid">
        <div><label htmlFor="trade-symbol">Symbol</label><input id="trade-symbol" value={draft.symbol} onChange={(event) => change('symbol', event.target.value)} maxLength={40} required autoCapitalize="characters" /></div>
        <div><label htmlFor="trade-side">Direction</label><select id="trade-side" value={draft.side} onChange={(event) => change('side', event.target.value)} required><option value="">Choose direction</option><option value="long">Long</option><option value="short">Short</option></select></div>
        <div><label htmlFor="trade-entry">Entry price</label><input id="trade-entry" value={draft.entryPrice} onChange={(event) => change('entryPrice', event.target.value)} inputMode="decimal" required /></div>
        <div><label htmlFor="trade-stop">Initial stop</label><input id="trade-stop" value={draft.stopPrice} onChange={(event) => change('stopPrice', event.target.value)} inputMode="decimal" required /></div>
        <div><label htmlFor="trade-exit">Exit price (optional)</label><input id="trade-exit" value={draft.exitPrice ?? ''} onChange={(event) => change('exitPrice', event.target.value)} inputMode="decimal" /></div>
      <div><label htmlFor="trade-setup">Setup name</label><input id="trade-setup" value={draft.setup} onChange={(event) => change('setup', event.target.value)} maxLength={120} required /></div>
      <div><label htmlFor="trade-opened">Opened at (your local time)</label><input id="trade-opened" type="datetime-local" value={draft.openedAt} onChange={(event) => change('openedAt', event.target.value)} required /></div>
      </div>
      <p className="capture-hint">Save now; add the exit later. The initial stop is used to calculate R.</p>
      <button type="submit">{pending === 'save' ? 'Saving…' : 'Save trade'}</button>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
    </fieldset>
  </form>
    <aside className="capture-recent" aria-labelledby="recent-heading">
      <h2 id="recent-heading">Recent trades</h2>
      <p className="capture-hint">Your three most recently saved trades.</p>
      {!recent || recent.owner !== userId ? <p>Loading recent trades…</p> : recent.error ? <div><p role="alert">{recent.error}</p><button type="button" onClick={() => setRecentRevision(value => value + 1)}>Retry recent trades</button></div> : recent.trades.length === 0 ? <p>No trades saved yet.</p> : recent.trades.map(trade => <article key={trade.id} className="capture-recent-item"><div><h3>{trade.symbol} · {trade.side}</h3><span>{trade.exit_price === null ? 'Needs exit' : resultLabel(trade.r_result)}</span></div><p>{trade.setup}</p><p className="capture-note-excerpt">{trade.original_note.slice(0, 160)}</p></article>)}
    </aside>
  </div>
}
