import { redirect } from 'next/navigation'
import SignInForm from '../components/sign-in-form'
import { getAuthenticatedUser } from '../../lib/supabase/server'

export const instant = false

export default async function SignIn() {
  if (await getAuthenticatedUser()) redirect('/')
  return <main className="sign-in-page"><div className="sign-in-card"><p className="brand">◼ Oneliner</p><h1>Sign in</h1><p>Get a code by email to start your journal.</p><SignInForm /></div></main>
}
