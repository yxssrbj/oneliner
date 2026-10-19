import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '../lib/supabase/server'
import AppShell from './components/app-shell'
import CaptureForm from './components/capture-form'

export const instant = false

export default async function Home() {
  const auth = await getAuthenticatedUser()
  if (!auth) redirect('/sign-in')
  return <AppShell title="Capture"><CaptureForm userId={auth.user.id} /></AppShell>
}
