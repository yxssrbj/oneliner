import {io} from 'next/cache'
import {redirect} from 'next/navigation'
import {isUuid} from '../../lib/groups/validation'
import {getAuthenticatedUser} from '../../lib/supabase/server'
import RegisterForm from '../components/register-form'

export const instant=false
export default async function Register({searchParams}:{searchParams:Promise<{invite?:string|string[]}>}){
  await io()
  const {invite}=await searchParams
  const token=isUuid(invite)?invite:undefined
  if(await getAuthenticatedUser())redirect(token?`/friends/invite/${token}`:'/')
  return <main className="sign-in-page"><div className="sign-in-card"><p className="brand">◼ Oneliner</p><h1>Create your account</h1><p>Start a private trading journal.</p><RegisterForm invite={token}/><p>Already have an account? <a href={token?`/sign-in?invite=${token}`:'/sign-in'}>Sign in</a></p></div></main>
}
