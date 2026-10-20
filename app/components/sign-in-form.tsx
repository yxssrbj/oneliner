'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { isUuid } from '../../lib/groups/validation'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

export default function SignInForm({invite}:{invite?:string} = {}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const result = await createSupabaseBrowserClient().auth.signInWithOtp({ email: email.trim() })
      if (result.error) setError('Could not send a code. Please try again.')
      else setSent(true)
    } catch {
      setError('Could not send a code. Please try again.')
    } finally {
      setPending(false)
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const result = await createSupabaseBrowserClient().auth.verifyOtp({ email: email.trim(), token: code, type: 'email' })
      if (result.error) setError('Invalid or expired code. Check it and try again.')
      else {
        router.replace(isUuid(invite)?`/friends/invite/${invite}`:'/')
        router.refresh()
      }
    } catch {
      setError('Could not verify the code. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={sent ? verifyCode : sendCode} className="auth-form">
      <label htmlFor="email">Email</label>
      <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={sent || pending} />
      {sent && <>
        <p>Enter the code sent to {email}.</p>
        <label htmlFor="code">Code</label>
        <input id="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}|[0-9]{8}" maxLength={8} required value={code} onChange={(event) => setCode(event.target.value)} disabled={pending} />
      </>}
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" disabled={pending}>{pending ? 'Please wait…' : sent ? 'Verify code' : 'Send code'}</button>
      {sent && <button type="button" className="text-button" onClick={() => { setSent(false); setCode(''); setError('') }}>Change email or request a new code</button>}
    </form>
  )
}
