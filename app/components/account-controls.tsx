'use client'

import Link from 'next/link'
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { themeFromUserMetadata } from '../../lib/theme'
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

type Theme = 'dark' | 'light'
const ThemeContext = createContext<{ ownerId: string | null; ready: boolean; theme: Theme; confirm: (userId: string, theme: Theme) => boolean } | null>(null)

export function useAccountTheme(userId: string) {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('Account theme provider is missing')
  return { theme: value.ownerId === userId ? value.theme : 'dark', ownerConfirmed: value.ready && value.ownerId === userId, confirmTheme: (theme: Theme) => value.confirm(userId, theme) }
}

export function AccountTheme({ userId, initialTheme, themeRevision, children }: { userId: string | null; initialTheme: Theme; themeRevision?: string; children?: ReactNode }) {
  const router = useRouter()
  const owner = useRef<string | null>(null)
  const [browserOwner, setBrowserOwner] = useState<string | null>(null)
  const [appearance, setAppearance] = useState({ userId, initialTheme, themeRevision, theme: initialTheme })
  // A fresh server revision can confirm the original color after a metadata update.
  const confirmedChanged = appearance.userId !== userId || appearance.initialTheme !== initialTheme || appearance.themeRevision !== themeRevision
  if (confirmedChanged) setAppearance({ userId, initialTheme, themeRevision, theme: initialTheme })
  const ready = userId !== null && browserOwner === userId
  const theme = ready ? confirmedChanged ? initialTheme : appearance.theme : 'dark'

  useLayoutEffect(() => {
    const matches = userId !== null && owner.current === userId
    document.documentElement.dataset.theme = matches ? theme : 'dark'
    document.documentElement.dataset.themeReady = String(matches)
  }, [userId, theme, ready])

  useEffect(() => {
    let active = true
    const { data: { subscription } } = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event !== 'SIGNED_OUT' && userId && session?.user.id === userId) {
        owner.current = userId
        setBrowserOwner(userId)
        // INITIAL_SESSION can contain metadata older than the verified server choice.
        if (event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
          const next = themeFromUserMetadata(session.user.user_metadata)
          setAppearance(value => value.userId === userId ? { ...value, theme: next } : value)
        }
        return
      }
      owner.current = null
      document.documentElement.dataset.theme = 'dark'
      document.documentElement.dataset.themeReady = 'false'
      setBrowserOwner(null)
      active = false
      if (session?.user.id || userId) {
        if (!isLocalSignOutPending() || event !== 'SIGNED_OUT') router.refresh()
      }
    })
    return () => { active = false; owner.current = null; setBrowserOwner(null); subscription.unsubscribe() }
  }, [router, userId])

  function confirm(accountId: string, next: Theme) {
    if (accountId !== userId || owner.current !== accountId) return false
    setAppearance(value => value.userId === accountId ? { ...value, theme: next } : value)
    return true
  }

  return <ThemeContext value={{ ownerId: userId, ready, theme, confirm }}>{children}</ThemeContext>
}
