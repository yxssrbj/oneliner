'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient, isLocalSignOutPending } from '../../lib/supabase/client'

export default function AccountControls({ userId, displayName, profileError, current = false }: {
  userId: string; displayName: string | null; profileError: boolean; current?: boolean
}) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let active = true
    const { data: { subscription } } = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event !== 'SIGNED_OUT' && session?.user.id === userId) {
        setReady(true)
        return
      }
      active = false
      document.documentElement.dataset.theme = 'dark'
      setHidden(true)
      // Supabase also emits SIGNED_OUT on failed logout; wait for its result.
      if (!isLocalSignOutPending() || event !== 'SIGNED_OUT') router.refresh()
    })
    return () => { active = false; setReady(false); subscription.unsubscribe() }
  }, [router, userId])

  return <div className="account-controls" aria-label="Account">
    <Link href="/settings" className="account-profile" aria-current={current ? 'page' : undefined}><span className="account-name">{hidden || !ready ? 'Trader' : displayName || 'Trader'}</span><span className="account-workspace">Personal workspace</span><span className="account-arrow" aria-hidden="true">›</span></Link>
    {!hidden && ready && profileError && <p role="alert" className="error">Could not load display name.</p>}
  </div>
}

export function AccountTheme({ userId, initialTheme }: { userId: string | null; initialTheme: 'dark' | 'light' }) {
  const router = useRouter()
  useEffect(() => {
    let active = true
    let initialized = false
    const { data: { subscription } } = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event !== 'SIGNED_OUT' && userId && session?.user.id === userId) {
        if (!initialized) {
          document.documentElement.dataset.theme = initialTheme
          document.documentElement.dataset.themeReady = 'true'
          initialized = true
        }
        return
      }
      document.documentElement.dataset.theme = 'dark'
      active = false
      if (session?.user.id || userId) {
        if (!isLocalSignOutPending() || event !== 'SIGNED_OUT') router.refresh()
      }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [router, userId, initialTheme])
  return null
}
