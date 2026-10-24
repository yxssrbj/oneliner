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
