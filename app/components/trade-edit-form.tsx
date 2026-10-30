'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { validateDraft } from '../../lib/trades/validation'

export type SavedTrade = { id: string; original_note: string | null; symbol: string; side: 'long' | 'short'; entry_price: string; stop_price: string | null; setup: string | null; opened_at: string; exit_price: string | null; r_result: string | null; source_net_pnl_usd?: string | null }

export function resultLabel(result: string | null, exitPrice: string | null = null): string {
  if (result === null) return exitPrice === null ? 'Pending outcome' : 'Closed · R unavailable'
  const r = Number(result)
  return `${r > 0 ? 'Win' : r < 0 ? 'Loss' : 'Breakeven'} · ${r > 0 ? '+' : ''}${r.toFixed(2)}R`
}

export default function TradeEditForm({ trade, onSaved }: { trade: SavedTrade; onSaved: (trade: SavedTrade) => void }) {
  const id = useId()
  const [draft, setDraft] = useState({ symbol: trade.symbol, side: trade.side, entryPrice: trade.entry_price, stopPrice: trade.stop_price ?? '', setup: trade.setup ?? '', openedAt: new Date(trade.opened_at).toISOString().slice(0, -1) })
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const busy = useRef(false)
  function change(field: keyof typeof draft, value: string) {
    setDraft({ ...draft, [field]: value }); setConfirmed(false); setSaved(false)
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy.current) return
    const result = validateDraft({ ...draft, originalNote: trade.original_note ?? 'original note absent', openedAt: `${draft.openedAt}Z` })
    if (result.error) { setError(result.error); return }
    if (!confirmed) { setError('Review and confirm the corrected fields.'); return }
    busy.current = true; setPending(true); setError(''); setSaved(false)
    try {
      const { originalNote: _, ...fields } = result.value!
      void _
      const response = await fetch(`/api/trades/${trade.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, confirmed: true }) })
      const body = await response.json()
      if (!response.ok || !body.trade?.id) throw new Error(body.error || 'Could not confirm the corrections were saved. Retry saving.')
      setSaved(true); onSaved(body.trade)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save corrections. Retry saving.') }
    finally { busy.current = false; setPending(false) }
  }
  return <form className="trade-form" onSubmit={save}>
    <p>Corrections recalculate R. Changing the opening time moves the trade to its corrected opening week. Original notes are kept.</p>
    <fieldset disabled={pending}>
      {trade.source_net_pnl_usd != null && <p>Source-reported net P&amp;L: {trade.source_net_pnl_usd} USD. Original source data stays unchanged when prices are corrected.</p>}
      <div className="trade-grid">
        <div><label htmlFor={`${id}-symbol`}>Symbol</label><input id={`${id}-symbol`} value={draft.symbol} onChange={event => change('symbol', event.target.value)} required maxLength={40} /></div>
        <div><label htmlFor={`${id}-side`}>Direction</label><select id={`${id}-side`} value={draft.side} onChange={event => change('side', event.target.value)}><option value="long">Long</option><option value="short">Short</option></select></div>
        <div><label htmlFor={`${id}-entry`}>Entry price</label><input id={`${id}-entry`} value={draft.entryPrice} onChange={event => change('entryPrice', event.target.value)} inputMode="decimal" required /></div>
        <div><label htmlFor={`${id}-stop`}>Initial stop</label><input id={`${id}-stop`} value={draft.stopPrice} onChange={event => change('stopPrice', event.target.value)} inputMode="decimal" required /></div>
      </div>
      <label htmlFor={`${id}-setup`}>Setup name</label><input id={`${id}-setup`} value={draft.setup} onChange={event => change('setup', event.target.value)} required maxLength={120} />
      <label htmlFor={`${id}-opened`}>Opened at (UTC)</label><input id={`${id}-opened`} type="datetime-local" step="0.001" value={draft.openedAt} onChange={event => change('openedAt', event.target.value.length === 16 ? `${event.target.value}:00` : event.target.value)} required />
      <label className="confirmation"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I reviewed these corrections</label>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit">{pending ? 'Saving…' : 'Save corrections'}</button>
    </fieldset>
    {saved && <p role="status">Corrections saved.</p>}
  </form>
}
