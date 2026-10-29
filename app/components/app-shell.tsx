import Link from 'next/link'
import AccountControls from './account-controls'
import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '../../lib/supabase/server'

const destinations = [
  { title: 'Review', href: '/review', label: 'Weekly review', icon: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></> },
  { title: 'Capture', href: '/', label: 'Capture a trade', icon: <path d="m15 5 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15z"/> },
  { title: 'Inbox', href: '/inbox', label: 'Unfinished', icon: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></> },
  { title: 'Friends', href: '/friends', label: 'Groups', icon: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/></> },
]

export default async function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const auth = await getAuthenticatedUser()
  if (!auth) redirect('/sign-in')
  const { data, error } = await auth.supabase.from('profiles').select('display_name').eq('id', auth.user.id).single()
  const profileError = !!error && error.code !== 'PGRST116'
  const pageTitle = destinations.find((item) => item.title === title)?.label ?? title
  return <div className="app-shell">
    <aside className="desktop-nav">
      <Link className="brand" href="/" aria-label="oneliner."><svg viewBox="0 0 28 28" aria-hidden="true"><path d="M3 20 11 8h7l-8 12h15"/></svg><span>oneliner<span className="brand-dot">.</span></span></Link>
      <nav aria-label="Main navigation">
        <div className="nav-label">Your workspace</div>
        {destinations.slice(0,3).map(item => <Link key={item.href} href={item.href} aria-current={item.title === title ? 'page' : undefined}><svg viewBox="0 0 24 24" aria-hidden="true">{item.icon}</svg>{item.label}</Link>)}
        <div className="nav-label nav-label-groups">Together, better</div>
        {destinations.slice(3).map(item => <Link key={item.href} href={item.href} aria-current={item.title === title ? 'page' : undefined}><svg viewBox="0 0 24 24" aria-hidden="true">{item.icon}</svg>{item.label}</Link>)}
      </nav>
      <div className="sidebar-note"><strong><span>A little reflection.</span><span>A better next trade.</span></strong><span>Your process, one line at a time.</span></div>
      <AccountControls current={title === 'Settings'} key={auth.user.id} userId={auth.user.id} displayName={profileError ? null : data?.display_name ?? null} profileError={profileError} />
    </aside>
    <div className="app-content">
      <header className="workspace-header"><div className="workspace-breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span>{title === 'Settings' ? <strong>Settings</strong> : <h1>{pageTitle}</h1>}</div><Link className="header-capture" href="/" aria-label="Start a new trade"><span aria-hidden="true">＋</span>Capture a trade</Link></header>
      <main>{children}</main>
    </div>
  </div>
}
