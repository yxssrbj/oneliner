'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

export const sharingDisclosure = 'Joining shares your display name, weekly total R, win rate, and completed count with current members. Results are self-reported. Your individual trades and notes stay private.'

export default function GroupForm({ inviteToken, onCreated, onIdentityChange }: {
  inviteToken?: string
  onCreated?: (id: string) => void
  onIdentityChange?: () => void
}) {
  const router = useRouter()
  const mutationRef = useRef<AbortController | null>(null)
  const accountRef = useRef<string | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [profileReady, setProfileReady] = useState(false)
  const [identityReady, setIdentityReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    let controller: AbortController | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    function changeAccount(userId: string | null) {
      if (accountRef.current === userId) return
      const previous = accountRef.current
      accountRef.current = userId
      setName('')
      if (previous !== undefined) onIdentityChange?.()
    }
    function invalidate() {
      clearTimeout(timer)
      controller?.abort()
      mutationRef.current?.abort()
      setPending(false)
      setChecking(true)
      setIdentityReady(false)
      setProfileReady(false)
      setError('')
    }
    async function revalidate() {
      invalidate()
      const request = new AbortController()
      controller = request
      try {
        const { data, error } = await supabase.auth.getUser()
        if (request.signal.aborted) return
        if (error) throw new Error('Could not verify your account. Try again.')
        changeAccount(data.user?.id ?? null)
        if (!data.user) throw new Error('Sign in required.')
        setIdentityReady(true)
        const response = await fetch('/api/profile', { cache: 'no-store', signal: request.signal })
        if (!response.ok) throw new Error('Could not load display name. Try saving it below.')
        const profile = await response.json()
        if (request.signal.aborted) return
        setProfileReady(!!profile.displayName)
      } catch (error) {
        if (!request.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load display name. Try again.')
      } finally {
        if (!request.signal.aborted) setChecking(false)
      }
    }
    const refresh = () => { void revalidate() }
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      invalidate()
      changeAccount(session?.user.id ?? null)
      // Defer auth reads until Supabase releases its session lock.
      timer = setTimeout(refresh, 0)
    })
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', visible)
    refresh()
    return () => {
      clearTimeout(timer)
      controller?.abort()
      mutationRef.current?.abort()
      subscription.unsubscribe()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [inviteToken, onIdentityChange, revision])

  async function submit(event: FormEvent, kind: 'create' | 'join') {
    event.preventDefault()
    if (checking || !identityReady || pending) return
    setPending(true)
    setError('')
    const controller = new AbortController()
    mutationRef.current = controller
    try {
      const response = await fetch(kind === 'create' ? '/api/groups' : '/api/groups/join', {
        signal: controller.signal, method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'create' ? { name } : { token: inviteToken }),
      })
      const data = await response.json()
      if (controller.signal.aborted) return
      if (!response.ok) throw new Error(data.error || 'Could not save. Try again.')
      if (kind === 'create') {
        setName('')
        onCreated?.(data.groupId)
      } else {
        router.replace(`/friends?group=${data.groupId}`)
        router.refresh()
      }
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not save. Try again.')
    } finally {
      if (!controller.signal.aborted) setPending(false)
    }
  }
  const disabled = pending || checking || !identityReady
  return <div className="group-forms">
    {inviteToken ? <form className="group-form" onSubmit={event => submit(event, 'join')} aria-label="Group sharing consent">
      <p id="sharing-disclosure">{sharingDisclosure}</p>
      {!checking && !profileReady && <p>Set your display name in <Link href="/settings">Settings</Link> before joining.</p>}
      <button disabled={disabled || !profileReady} aria-describedby="sharing-disclosure">Join group</button>
    </form> : <form className="group-form" onSubmit={event => submit(event, 'create')}>
      <label htmlFor="group-name">Group name</label>
      <input id="group-name" required maxLength={80} value={name} onChange={event => setName(event.target.value)} disabled={disabled} />
      {!checking && !profileReady && <p>Set your display name in <Link href="/settings">Settings</Link> before creating a group.</p>}
      <button disabled={disabled || !profileReady}>Create group</button>
    </form>}
    {error && <p role="alert" className="error">{error}</p>}
    {!checking && !identityReady && <button onClick={() => setRevision(value => value + 1)}>Try again</button>}
  </div>
}
