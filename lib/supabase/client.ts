import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}

let localSignOutPending = false

export function isLocalSignOutPending() { return localSignOutPending }

export async function signOutLocally() {
  localSignOutPending = true
  try {
    return await createSupabaseBrowserClient().auth.signOut({ scope: 'local' })
  } finally {
    localSignOutPending = false
  }
}

export async function saveAccountMetadata(userId: string, metadata: Record<string, unknown>) {
  const { data: { session }, error } = await createSupabaseBrowserClient().auth.getSession()
  if (error || !session || session.user.id !== userId || localSignOutPending) throw new Error('Account session changed')
  // SDK updateUser persists its captured session, which can restore a signed-out account.
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')}/auth/v1/user`, {
    method: 'PUT', credentials: 'omit', signal: AbortSignal.timeout(15_000),
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: metadata }),
  })
  if (!response.ok) throw new Error('Could not save account preferences')
  const user: unknown = await response.json()
  if (!user || typeof user !== 'object' || !('id' in user) || user.id !== userId ||
      !('user_metadata' in user) || !user.user_metadata || typeof user.user_metadata !== 'object' || Array.isArray(user.user_metadata)) {
    throw new Error('Unconfirmed account preference')
  }
  return { data: { user: { id: user.id, user_metadata: user.user_metadata as Record<string, unknown> } }, error: null }
}
