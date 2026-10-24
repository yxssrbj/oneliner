'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient, isLocalSignOutPending } from '../../lib/supabase/client'

export default function AccountControls({ userId, displayName, profileError, current = false }: {
  userId: string; displayName: string | null; profileError: boolean; current?: boolean
}) {
  const router = useRouter()
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_OUT' && session?.user.id === userId) return
      setHidden(true)
      // Supabase also emits SIGNED_OUT on failed logout; wait for its result.
      if (!isLocalSignOutPending() || event !== 'SIGNED_OUT') router.refresh()
    })
    return () => subscription.unsubscribe()
  }, [router, userId])

  return <div className="account-controls" aria-label="Account">
    <Link href="/settings" className="account-profile" aria-current={current ? 'page' : undefined}><span className="account-name">{hidden ? 'Trader' : displayName || 'Trader'}</span><span className="account-workspace">Personal workspace</span><span className="account-arrow" aria-hidden="true">›</span></Link>
    {!hidden && profileError && <p role="alert" className="error">Could not load display name.</p>}
  </div>
}
