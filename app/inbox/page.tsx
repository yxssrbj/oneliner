import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '../../lib/supabase/server'
import { weekStartUtc } from '../../lib/trades/week'
import AppShell from '../components/app-shell'
import TradeWorkspace from '../components/trade-workspace'

export const instant = false

export default async function Inbox() {
  await connection()
  const auth = await getAuthenticatedUser()
  if (!auth) redirect('/sign-in')
  return <AppShell title="Inbox"><TradeWorkspace mode="inbox" userId={auth.user.id} initialWeek={weekStartUtc(new Date())} /></AppShell>
}
