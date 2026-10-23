'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

export default function AccountControls({ userId, displayName, profileError }: {
  userId: string; displayName: string | null; profileError: boolean
}) {
  const router = useRouter()
  const busy = useRef(false)
  const mounted = useRef(false)
  const accountChanged = useRef(false)
  const [hidden, setHidden] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    mounted.current = true
    const { data: { subscription } } = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_OUT' && session?.user.id === userId) return
      if (session?.user.id && session.user.id !== userId) accountChanged.current = true
      setHidden(true)
      setError('')
      // Supabase also emits SIGNED_OUT on failed logout; wait for its result.
      if (!busy.current || event !== 'SIGNED_OUT') router.refresh()
    })
    return () => { mounted.current = false; subscription.unsubscribe() }
  }, [router, userId])

  async function signOut() {
    if (busy.current || accountChanged.current) return
    busy.current = true
    setPending(true)
    setError('')
    try {
      const { error } = await createSupabaseBrowserClient().auth.signOut({ scope: 'local' })
      if (error) throw error
      if (!mounted.current || accountChanged.current) return
      setHidden(true)
      router.replace('/sign-in')
      router.refresh()
    } catch {
      if (mounted.current && !accountChanged.current) setError('Could not sign out. Try again.')
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return <div className="account-controls" aria-label="Account">
    <span className="account-name">{hidden ? 'Trader' : displayName || 'Trader'}</span>
    {!hidden && profileError && <p role="alert" className="error">Could not load display name.</p>}
    <button type="button" disabled={pending || (hidden && !error)} onClick={signOut}>{pending ? 'Signing out…' : 'Sign out'}</button>
    {error && <p role="alert" className="error">{error}</p>}
  </div>
}
