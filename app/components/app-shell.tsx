import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '../../lib/supabase/server'

const destinations = [
  { href: '/', label: 'Capture' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/review', label: 'Review' },
  { href: '/friends', label: 'Friends' },
]

export default async function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const auth = await getAuthenticatedUser()
  if (!auth) redirect('/sign-in')
  return <div className="app-shell">
    <aside className="desktop-nav"><Link className="brand" href="/">◼ Oneliner</Link><nav aria-label="Main navigation">{destinations.map((item) => <Link key={item.href} href={item.href} aria-current={item.label === title ? 'page' : undefined}>{item.label}</Link>)}</nav></aside>
    <div className="app-content"><header className="mobile-header"><Link className="brand" href="/">◼ Oneliner</Link></header><main><h1>{title}</h1>{children}</main></div>
    <nav className="mobile-nav" aria-label="Main navigation">{destinations.map((item) => <Link key={item.href} href={item.href} aria-current={item.label === title ? 'page' : undefined}>{item.label}</Link>)}</nav>
  </div>
}
