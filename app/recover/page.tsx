import {io} from 'next/cache'
import RecoverForm from '../components/recover-form'

export const instant=false
export default async function Recover(){
  await io()
  return <main className="sign-in-page"><div className="sign-in-card"><p className="brand">◼ Oneliner</p><h1>Reset password</h1><p>Verify your email with a code, then choose a new password.</p><RecoverForm/><p><a href="/sign-in">Back to sign in</a></p></div></main>
}
