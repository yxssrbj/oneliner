import { io } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '../../lib/supabase/server'
import AppShell from '../components/app-shell'
import SettingsClient from './settings-client'

export const instant = false

export default async function SettingsPage() {
  // Supabase session initialization reads time and cannot run during prerendering.
  await io()
  const auth = await getAuthenticatedUser()
  if (!auth) redirect('/sign-in')
  const { data, error } = await auth.supabase.from('profiles').select('display_name').eq('id', auth.user.id).single()
  const profileError = !!error && error.code !== 'PGRST116'
  return <AppShell title="Settings">
    {profileError && <p role="alert" className="error">Could not load display name. Refresh to try again.</p>}
    <SettingsClient key={auth.user.id} userId={auth.user.id} email={auth.user.email ?? ''} initialDisplayName={profileError ? null : data?.display_name ?? null} />
  </AppShell>
}
