'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { isUuid } from '../../lib/groups/validation'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

export default function SignInForm({invite, passwordUpdated = false}:{invite?:string; passwordUpdated?:boolean} = {}) {
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [passwordMode, setPasswordMode] = useState(passwordUpdated)
  const busy = useRef(false)
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const {data: {subscription}} = createSupabaseBrowserClient().auth.onAuthStateChange(() => setReady(true))
    return () => {setReady(false); subscription.unsubscribe()}
  }, [])

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || !ready) return
    busy.current = true
    setPending(true)
    setError('')
    try {
      const result = await createSupabaseBrowserClient().auth.signInWithOtp({ email: email.trim() })
      if (result.error) setError('Could not send a code. Please try again.')
      else setSent(true)
    } catch {
      setError('Could not send a code. Please try again.')
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || !ready) return
    busy.current = true
    setPending(true)
    setError('')
    try {
      const result = await createSupabaseBrowserClient().auth.verifyOtp({ email: email.trim(), token: code, type: 'email' })
      if (result.error) setError('Invalid or expired code. Check it and try again.')
      else {
        // A new document clears private routes cached before the account changed.
        location.replace(isUuid(invite)?`/friends/invite/${invite}`:'/')
      }
    } catch {
      setError('Could not verify the code. Please try again.')
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  async function signInPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || !ready) return
    busy.current = true
    setPending(true)
    setError('')
    try {
      const { data, error } = await createSupabaseBrowserClient().auth.signInWithPassword({ email: email.trim(), password })
      if (error || !data.user || !data.session || data.user.id !== data.session.user.id) throw new Error('Unconfirmed sign-in')
      setPassword('')
      location.replace(isUuid(invite) ? `/friends/invite/${invite}` : '/')
    } catch {
      setError('Could not sign in. Check your email and password or use an email code.')
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  function changeMethod() {
    setPasswordMode(!passwordMode)
    setPassword('')
    setCode('')
    setSent(false)
    setError('')
  }

  return (
    <form onSubmit={passwordMode ? signInPassword : sent ? verifyCode : sendCode} className="auth-form">
      {passwordUpdated && <p role="status">Password updated. Sign in with your new password.</p>}
      <label htmlFor="email">Email</label>
      <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={sent || pending || !ready} />
      {passwordMode && <>
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={pending || !ready}/>
      </>}
      {sent && <>
        <p>Enter the code sent to {email}.</p>
        <label htmlFor="code">Code</label>
        <input id="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}|[0-9]{8}" maxLength={8} required value={code} onChange={(event) => setCode(event.target.value)} disabled={pending || !ready} />
      </>}
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" disabled={pending || !ready}>{pending ? 'Please wait…' : passwordMode ? 'Sign in' : sent ? 'Verify code' : 'Send code'}</button>
      <button type="button" className="text-button" disabled={pending || !ready} onClick={changeMethod}>{passwordMode ? 'Use email code instead' : 'Use password instead'}</button>
      {sent && <button type="button" className="text-button" disabled={pending || !ready} onClick={() => { setSent(false); setCode(''); setError('') }}>Change email or request a new code</button>}
    </form>
  )
}
