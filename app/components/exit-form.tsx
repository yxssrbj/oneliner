'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { isPrice } from '../../lib/trades/validation'
import { resultLabel, type SavedTrade } from './trade-edit-form'

export default function ExitForm({ trade, onSaved }: { trade: SavedTrade; onSaved: (trade: SavedTrade) => void }) {
  const id = useId()
  const [exit, setExit] = useState(trade.exit_price ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SavedTrade | null>(null)
  const busy = useRef(false)
  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy.current) return
    if (!isPrice(exit)) { setError('Exit must be a positive decimal price.'); return }
    busy.current = true; setPending(true); setError(''); setResult(null)
    try {
      const response = await fetch(`/api/trades/${trade.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exitPrice: exit }) })
      const body = await response.json()
      if (!response.ok || !body.trade?.id || body.trade.r_result == null) throw new Error(body.error || 'Could not confirm the exit was saved. Retry saving.')
      setResult(body.trade); onSaved(body.trade)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the exit. Retry saving.') }
    finally { busy.current = false; setPending(false) }
  }
  return <form className="trade-form" onSubmit={save}>
    <fieldset disabled={pending}>
      <label htmlFor={id}>Exit price</label>
      <input id={id} inputMode="decimal" value={exit} onChange={event => { setExit(event.target.value); setResult(null) }} required />
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit">{pending ? 'Saving…' : 'Save exit'}</button>
    </fieldset>
    {result && <p role="status">{resultLabel(result.r_result)}</p>}
  </form>
}
