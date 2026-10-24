'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

export default function SettingsClient({ userId, email, initialDisplayName }: {
  userId: string; email: string; initialDisplayName: string | null
}) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '')
  const [confirmedName, setConfirmedName] = useState(initialDisplayName)
  const [hidden, setHidden] = useState(false)
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const active = useRef(true)
  const busy = useRef(false)

  useEffect(() => {
    active.current = true
    const { data: { subscription } } = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_OUT' && session?.user.id === userId) { setReady(true); return }
      active.current = false
      setHidden(true)
      router.refresh()
    })
    return () => { active.current = false; subscription.unsubscribe() }
  }, [router, userId])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || !active.current || !ready) return
    const name = displayName.trim()
    setSaved(false)
    if (!name || name.length > 80) { setError('Display name must be 1–80 characters.'); return }
    busy.current = true
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: name }) })
      const result = await response.json()
      if (!response.ok || typeof result?.displayName !== 'string' || !result.displayName.trim() || result.displayName.length > 80) throw new Error('Unconfirmed profile save')
      if (!active.current) return
      setDisplayName(result.displayName)
      setConfirmedName(result.displayName)
      setSaved(true)
      router.refresh()
    } catch {
      if (active.current) setError('Could not save display name. Try again.')
    } finally {
      busy.current = false
      if (active.current) setPending(false)
    }
  }

  if (hidden) return <p role="status">Updating account…</p>
  return <div className="settings-workspace">
    <p>Your name and account security.</p>
    <div className="settings-grid">
      <section className="settings-panel" aria-labelledby="profile-title">
        <h2 id="profile-title">Profile</h2>
        <p>How your name appears in your workspace and groups.</p>
        <div className="settings-identity"><strong>{confirmedName || 'Trader'}</strong><p>Personal workspace</p></div>
        <form onSubmit={save} noValidate>
          <label htmlFor="settings-display-name">Display name</label>
          <input id="settings-display-name" name="displayName" autoComplete="name" required maxLength={80} value={displayName} disabled={pending || !ready} aria-invalid={!!error} aria-describedby={error ? 'profile-error' : undefined} onChange={event => { setDisplayName(event.target.value); setError(''); setSaved(false) }} />
          <label htmlFor="settings-email">Email address</label>
          <input id="settings-email" type="email" value={email} readOnly aria-describedby="email-hint" />
          <p id="email-hint" className="field-hint">Your sign-in email cannot be changed here.</p>
          {error && <p id="profile-error" role="alert" className="error">{error}</p>}
          <div className="settings-actions"><span role="status" className="save-message">{saved ? 'Display name saved.' : pending ? 'Saving display name…' : ''}</span><button type="submit" disabled={pending || !ready}>{pending ? 'Saving…' : 'Save display name'}</button></div>
        </form>
      </section>
    </div>
  </div>
}
