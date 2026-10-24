import Link from 'next/link'
import AccountControls from './account-controls'
import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '../../lib/supabase/server'

const destinations = [
  { title: 'Review', href: '/review', label: 'Weekly review' },
  { title: 'Capture', href: '/', label: 'Capture a trade' },
  { title: 'Inbox', href: '/inbox', label: 'Unfinished' },
  { title: 'Friends', href: '/friends', label: 'Groups' },
]

export default async function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const auth = await getAuthenticatedUser()
  if (!auth) redirect('/sign-in')
  const { data, error } = await auth.supabase.from('profiles').select('display_name').eq('id', auth.user.id).single()
  const profileError = !!error && error.code !== 'PGRST116'
  const pageTitle = destinations.find((item) => item.title === title)?.label ?? title
  return <div className="app-shell">
    <aside className="desktop-nav">
      <Link className="brand" href="/">◼ Oneliner</Link>
      <nav aria-label="Main navigation">{destinations.map((item) => <Link key={item.href} href={item.href} aria-current={item.title === title ? 'page' : undefined}>{item.label}</Link>)}</nav>
      <AccountControls current={title === 'Settings'} key={auth.user.id} userId={auth.user.id} displayName={profileError ? null : data?.display_name ?? null} profileError={profileError} />
    </aside>
    <div className="app-content">
      <header className="workspace-header"><h1>{pageTitle}</h1></header>
      <main>{children}</main>
    </div>
  </div>
}
