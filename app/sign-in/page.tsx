import { isUuid } from '../../lib/groups/validation'
import { redirect } from 'next/navigation'
import SignInForm from '../components/sign-in-form'
import { getAuthenticatedUser } from '../../lib/supabase/server'

export const instant = false

export default async function SignIn({searchParams}:{searchParams:Promise<{invite?:string|string[]}>}) {
  const {invite}=await searchParams
  const token=isUuid(invite)?invite:undefined
  if (await getAuthenticatedUser()) redirect(token?`/friends/invite/${token}`:'/')
  return <main className="sign-in-page"><div className="sign-in-card"><p className="brand">◼ Oneliner</p><h1>Sign in</h1><p>Get a code by email to start your journal.</p><SignInForm invite={token} /></div></main>
}
