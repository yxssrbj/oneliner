'use client'

import {useEffect, useRef, useState, type FormEvent} from 'react'
import {createPasswordVerificationClient, createSupabaseBrowserClient} from '../../lib/supabase/client'

async function closeVerification(client: ReturnType<typeof createPasswordVerificationClient>) {
  try {
    const {error} = await client.auth.signOut({scope: 'local'})
    if (error) console.error('Could not close password verification session.')
  } catch {
    console.error('Could not close password verification session.')
  }
}

export default function PasswordForm({userId, email}: {userId: string; email: string}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [code, setCode] = useState('')
  const [emailMode, setEmailMode] = useState(false)
  const [sent, setSent] = useState(false)
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const active = useRef<object | null>(null)
  const busy = useRef(false)

  useEffect(() => {
    const owner = {}
    active.current = owner
    const {data: {subscription}} = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (active.current !== owner) return
      if (event !== 'SIGNED_OUT' && session?.user.id === userId) {setReady(true); return}
      active.current = null
      setReady(false)
      setCurrentPassword(''); setPassword(''); setConfirmation(''); setCode(''); setSent(false); setError('')
    })
    return () => {
      active.current = null
      busy.current = false
      setReady(false); setPending(false); setSent(false)
      setCurrentPassword(''); setPassword(''); setConfirmation(''); setCode(''); setError('')
      subscription.unsubscribe()
    }
  }, [userId])

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || !active.current || !ready) return
    setError('')
    if (password.length < 8) {setError('Use a password with at least 8 characters.'); return}
    if (password !== confirmation) {setError('Passwords do not match.'); return}
    if (!emailMode && !currentPassword) {setError('Enter your current password or use an email code.'); return}
    const owner = active.current
    const client = createPasswordVerificationClient()
    busy.current = true
    setPending(true)
    let step = emailMode ? 'send' : 'current'
    try {
      if (!emailMode) {
        const {data, error} = await client.auth.signInWithPassword({email, password: currentPassword})
        if (error || data.user?.id !== userId || data.session?.user.id !== userId) throw new Error('Unconfirmed current password')
      }
      if (active.current !== owner) return
      step = 'send'
      const {error} = await client.auth.signInWithOtp({email, options: {shouldCreateUser: false}})
      if (error) throw new Error('Unconfirmed code delivery')
      if (active.current === owner) setSent(true)
    } catch {
      if (active.current === owner) setError(step === 'current' ? 'Could not verify your current password. Check it or use an email code.' : 'Could not send a verification code. Try again.')
    } finally {
      await closeVerification(client)
      if (active.current === owner) {busy.current = false; setPending(false)}
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || !active.current || !ready) return
    setError('')
    if (!/^(?:\d{6}|\d{8})$/.test(code)) {setError('Enter the 6 or 8 digit verification code.'); return}
    const owner = active.current
    const client = createPasswordVerificationClient()
    busy.current = true
    setPending(true)
    let verified = false
    let updated = false
    try {
      // Fresh email OTP verification also checks codes for sessions under 24 hours.
      const {data, error} = await client.auth.verifyOtp({email, token: code, type: 'email'})
      if (error || data.user?.id !== userId || data.session?.user.id !== userId) throw new Error('Unconfirmed email verification')
      if (active.current !== owner) return
      verified = true
      const result = await client.auth.updateUser({password, ...(!emailMode && {current_password: currentPassword})})
      if (result.error || result.data.user?.id !== userId) {
        if (active.current === owner) setError(result.error?.code === 'weak_password' ? 'Choose a stronger password that meets the account password policy.' : 'Could not update password. Check the details and try again.')
        return
      }
      updated = true
    } catch {
      if (active.current === owner) setError(verified ? 'Could not update password. Check the details and try again.' : 'Could not verify the code. Check it or request a new one.')
    } finally {
      await closeVerification(client)
      if (active.current === owner) {
        busy.current = false
        setPending(false)
        if (verified) {setCode(''); setSent(false)}
        if (updated) {
          setCurrentPassword(''); setPassword(''); setConfirmation(''); setCode('')
          // GoTrue revokes the original session; proxy clears its cookies on arrival.
          location.replace('/sign-in?password=updated')
        }
      }
    }
  }

  if (!ready) return null
  return <section className="settings-panel" aria-labelledby="password-title">
    <h2 id="password-title">Password</h2>
    <p>Verify by email before setting or changing your password.</p>
    <form onSubmit={sent ? updatePassword : sendCode} noValidate>
      {!emailMode && <><label htmlFor="settings-current-password">Current password</label><input id="settings-current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={pending || sent}/></>}
      <button className="text-button" type="button" disabled={pending} onClick={() => {setEmailMode(!emailMode); setCurrentPassword(''); setCode(''); setSent(false); setError('')}}>{emailMode ? 'Use current password instead' : 'Use email code instead'}</button>
      <label htmlFor="settings-new-password">New password</label>
      <input id="settings-new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} disabled={pending || sent} aria-describedby="password-hint"/>
      <p className="field-hint" id="password-hint">At least 8 characters. Your account password policy also applies.</p>
      <label htmlFor="settings-confirm-password">Confirm new password</label>
      <input id="settings-confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={pending || sent}/>
      {sent && <><p>Enter the code sent to your account email.</p><label htmlFor="settings-password-code">Verification code</label><input id="settings-password-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}|[0-9]{8}" maxLength={8} required value={code} onChange={event => setCode(event.target.value)} disabled={pending}/><button className="text-button" type="button" disabled={pending} onClick={() => {setSent(false); setCode(''); setError('')}}>Change password details or request a new code</button></>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="settings-actions"><button type="submit" disabled={pending}>{pending ? sent ? 'Updating password…' : 'Sending code…' : sent ? 'Update password' : 'Send verification code'}</button></div>
    </form>
  </section>
}
