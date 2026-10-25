'use client'

import {useRef,useState,type FormEvent} from 'react'
import {createSupabaseBrowserClient} from '../../lib/supabase/client'

export default function RecoverForm(){
  const [email,setEmail]=useState(''),[code,setCode]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('')
  const [sent,setSent]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('')
  const busy=useRef(false)
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(busy.current)return
    setError('')
    if(sent){
      if(!/^(?:\d{6}|\d{8})$/.test(code)){setError('Enter the 6 or 8 digit recovery code.');return}
      if(password.length<8){setError('Use a password with at least 8 characters.');return}
      if(password!==confirmation){setError('Passwords do not match.');return}
    }
    busy.current=true;setPending(true)
    const client=createSupabaseBrowserClient()
    let verified=false
    try{
      if(!sent){
        const {error:failure}=await client.auth.resetPasswordForEmail(email.trim())
        if(failure)console.error('Recovery request failed:',failure.message)
        setSent(true)
      }else{
        const {data,error:failure}=await client.auth.verifyOtp({email:email.trim(),token:code,type:'recovery'})
        if(failure || !data.user || !data.session || data.user.id!==data.session.user.id){setError('Invalid or expired code. Check it or request a new one.');return}
        verified=true
        const result=await client.auth.updateUser({password})
        if(result.error || result.data.user?.id!==data.user.id){setError('Could not update password. Check your password and try again.');return}
        setPassword('');setConfirmation('');setCode('')
        const signedOut=await client.auth.signOut()
        if(signedOut.error){setError('Password updated, but sign-out failed. Sign out before continuing.');return}
        location.replace('/sign-in?password=updated')
      }
    }catch(error){console.error('Recovery failed:',error);setError(sent?'Could not reset the password. Try again.':'Could not request a recovery code. Try again.')}
    finally{
      if(verified && password)try{const result=await client.auth.signOut();if(result.error)console.error('Recovery sign-out failed:',result.error.message)}catch(error){console.error('Recovery sign-out failed:',error)}
      busy.current=false;setPending(false)
    }
  }
  return <form className="auth-form" onSubmit={submit}>
    <label htmlFor="recovery-email">Email</label><input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} disabled={sent||pending}/>
    {sent&&<>
      <p>If an account exists for that email, a recovery code was sent.</p>
      <label htmlFor="recovery-code">Recovery code</label><input id="recovery-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}|[0-9]{8}" maxLength={8} required value={code} onChange={event=>setCode(event.target.value)} disabled={pending}/>
      <label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event=>setPassword(event.target.value)} disabled={pending}/>
      <label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={event=>setConfirmation(event.target.value)} disabled={pending}/>
    </>}
    {error&&<p role="alert" className="error">{error}</p>}
    <button type="submit" disabled={pending}>{pending?'Please wait…':sent?'Reset password':'Send recovery code'}</button>
  </form>
}
