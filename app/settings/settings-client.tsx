'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import PasswordForm from './password-form'
import { useAccountTheme } from '../components/account-controls'
import { createSupabaseBrowserClient, isLocalSignOutPending, saveAccountMetadata } from '../../lib/supabase/client'

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
  const { theme, ownerConfirmed, confirmTheme } = useAccountTheme(userId)
  const [themePending, setThemePending] = useState(false)
  const [themeError, setThemeError] = useState('')
  const metadata = useRef<Record<string, unknown> | null>(null)
  const themeBusy = useRef(false)
  const active = useRef<object | null>(null)
  const busy = useRef(false)

  useEffect(() => {
    // Cached pages can resume; each effect owns only its own requests.
    const owner = {}
    active.current = owner
    const { data: { subscription } } = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (active.current !== owner) return
      if (event !== 'SIGNED_OUT' && session?.user.id === userId) {
        metadata.current = session.user.user_metadata ?? {}
        setReady(true)
        return
      }
      document.documentElement.dataset.theme = 'dark'
      active.current = null
      setHidden(true)
      // Failed local logout also removes the SDK session; preserve its retry.
      if (!isLocalSignOutPending() || event !== 'SIGNED_OUT') router.refresh()
    })
    return () => {
      active.current = null
      busy.current = false
      themeBusy.current = false
      setReady(false)
      setPending(false)
      setThemePending(false)
      subscription.unsubscribe()
    }
  }, [router, userId])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || !active.current || !ready || !ownerConfirmed) return
    const owner = active.current
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
      if (active.current !== owner) return
      setDisplayName(result.displayName)
      setConfirmedName(result.displayName)
      setSaved(true)
      router.refresh()
    } catch {
      if (active.current === owner) setError('Could not save display name. Try again.')
    } finally {
      if (active.current === owner) { busy.current = false; setPending(false) }
    }
  }

  async function changeTheme() {
    if (themeBusy.current || !active.current || !ready || !ownerConfirmed) return
    const owner = active.current
    const next = theme === 'dark' ? 'light' : 'dark'
    themeBusy.current = true
    setThemePending(true)
    setThemeError('')
    try {
      const { data, error } = await saveAccountMetadata(userId, { ...metadata.current, oneliner_theme: next })
      if (active.current !== owner) return
      if (error || data.user?.id !== userId || data.user.user_metadata?.oneliner_theme !== next) throw new Error('Unconfirmed appearance save')
      if (!confirmTheme(next)) throw new Error('Account session changed')
      router.refresh()
    } catch {
      if (active.current === owner) setThemeError('Could not save appearance. Try again.')
    } finally {
      if (active.current === owner) { themeBusy.current = false; setThemePending(false) }
    }
  }

  if (hidden || !ready || !ownerConfirmed) return <p role="status">Updating account…</p>
  return <div className="settings-workspace">
    <div className="settings-heading"><div><h1>Settings</h1><p>Your name and account security.</p></div><button className="theme-toggle" type="button" disabled={themePending} onClick={changeTheme}>{themePending ? 'Saving appearance…' : `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}</button></div>
    {themeError && <p role="alert" className="error">{themeError}</p>}
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
      <PasswordForm key={userId} userId={userId} email={email}/>
    </div>
  </div>
}
