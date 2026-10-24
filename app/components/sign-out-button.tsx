'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient, isLocalSignOutPending, signOutLocally } from '../../lib/supabase/client'

export default function SignOutButton({ userId }: { userId: string }) {
  const router = useRouter()
  const busy = useRef(false)
  const mounted = useRef(false)
  const accountChanged = useRef(false)
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    mounted.current = true
    const { data: { subscription } } = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_OUT' && session?.user.id === userId) { setReady(true); return }
      if (session?.user.id && session.user.id !== userId) accountChanged.current = true
      setReady(false)
      setError('')
      if (!isLocalSignOutPending() || event !== 'SIGNED_OUT') router.refresh()
    })
    return () => { mounted.current = false; subscription.unsubscribe() }
  }, [router, userId])

  async function signOut() {
    if (busy.current || isLocalSignOutPending() || accountChanged.current || (!ready && !error)) return
    busy.current = true
    setPending(true)
    setError('')
    try {
      const { error } = await signOutLocally()
      if (error) throw error
      if (!mounted.current || accountChanged.current) return
      setReady(false)
      router.replace('/sign-in')
      router.refresh()
    } catch {
      if (mounted.current && !accountChanged.current) setError('Could not sign out. Try again.')
    } finally {
      busy.current = false
      if (mounted.current) setPending(false)
    }
  }

  return <div className="settings-sign-out">
    <button type="button" disabled={pending || (!ready && !error)} onClick={signOut}>{pending ? 'Signing out…' : 'Sign out'}</button>
    {error && <p role="alert" className="error">{error}</p>}
  </div>
}
