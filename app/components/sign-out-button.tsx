'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient, isLocalSignOutPending, signOutLocally } from '../../lib/supabase/client'

export default function SignOutButton({ userId }: { userId: string }) {
  const router = useRouter()
  const busy = useRef(false)
  const active = useRef<object | null>(null)
  const accountChanged = useRef(false)
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const owner = {}
    active.current = owner
    const { data: { subscription } } = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (active.current !== owner) return
      if (event !== 'SIGNED_OUT' && session?.user.id === userId) { setReady(true); return }
      document.documentElement.dataset.theme = 'dark'
      if (session?.user.id && session.user.id !== userId) accountChanged.current = true
      setReady(false)
      setError('')
      if (!isLocalSignOutPending() || event !== 'SIGNED_OUT') router.refresh()
    })
    return () => {
      active.current = null
      busy.current = false
      setReady(false)
      setPending(false)
      setError('')
      subscription.unsubscribe()
    }
  }, [router, userId])

  async function signOut() {
    if (!active.current || busy.current || isLocalSignOutPending() || accountChanged.current || (!ready && !error)) return
    const owner = active.current
    busy.current = true
    document.documentElement.dataset.theme = 'dark'
    setPending(true)
    setError('')
    try {
      const { error } = await signOutLocally()
      if (error) throw error
      if (active.current !== owner || accountChanged.current) return
      document.documentElement.dataset.theme = 'dark'
      setReady(false)
      router.replace('/sign-in')
      router.refresh()
    } catch {
      if (active.current === owner && !accountChanged.current) setError('Could not sign out. Try again.')
    } finally {
      if (active.current === owner) { busy.current = false; setPending(false) }
    }
  }

  return <div className="settings-sign-out">
    <button type="button" disabled={pending || (!ready && !error)} onClick={signOut}>{pending ? 'Signing out…' : 'Sign out'}</button>
    {error && <p role="alert" className="error">{error}</p>}
  </div>
}
