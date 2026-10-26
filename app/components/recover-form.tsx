'use client'

import {useRef,useState,useSyncExternalStore,type FormEvent} from 'react'
import {createPasswordVerificationClient,createSupabaseBrowserClient} from '../../lib/supabase/client'

export default function RecoverForm(){
  const [email,setEmail]=useState(''),[code,setCode]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('')
  const [sent,setSent]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('')
  const busy=useRef(false)
  const ready=useSyncExternalStore(()=>()=>{},()=>true,()=>false)
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(busy.current || !ready)return
    setError('')
    if(sent){
      if(!/^(?:\d{6}|\d{8})$/.test(code)){setError('Enter the 6 or 8 digit recovery code.');return}
      if(password.length<8){setError('Use a password with at least 8 characters.');return}
      if(password!==confirmation){setError('Passwords do not match.');return}
    }
    busy.current=true;setPending(true)
    const recovery=sent?createPasswordVerificationClient():null
    let updated=false
    try{
      if(!sent){
        const {error:failure}=await createSupabaseBrowserClient().auth.resetPasswordForEmail(email.trim())
        if(failure){console.error('Recovery request failed:',failure.message);setError('Could not send a recovery code. Try again.');return}
        setSent(true)
      }else{
        const {data,error:failure}=await recovery!.auth.verifyOtp({email:email.trim(),token:code,type:'recovery'})
        if(failure || !data.user || !data.session || data.user.id!==data.session.user.id){setError('Invalid or expired code. Check it or request a new one.');return}
        const result=await recovery!.auth.updateUser({password})
        if(result.error || result.data.user?.id!==data.user.id){setError('Could not update password. Check your password and try again.');return}
        setPassword('');setConfirmation('');setCode('')
        updated=true
      }
    }catch(error){console.error('Recovery failed:',error);setError(sent?'Could not reset the password. Try again.':'Could not request a recovery code. Try again.')}
    finally{
      if(recovery){
        try{const result=await recovery.auth.signOut({scope:'local'});if(result.error)console.error('Recovery sign-out failed:',result.error.message)}catch(error){console.error('Recovery sign-out failed:',error)}
        try{await recovery.auth.dispose()}catch(error){console.error('Recovery client disposal failed:',error)}
      }
      busy.current=false;setPending(false)
    }
    if(updated)location.replace('/sign-in?password=updated')
  }
  async function resendCode(){
    if(busy.current || !sent)return
    busy.current=true;setPending(true);setError('')
    try{
      const {error:failure}=await createSupabaseBrowserClient().auth.resetPasswordForEmail(email.trim())
      if(failure){console.error('Recovery code resend failed:',failure.message);setError('Could not send a new code. Try again.');return}
      setCode('')
    }catch(error){console.error('Recovery code resend failed:',error);setError('Could not send a new code. Try again.')}
    finally{busy.current=false;setPending(false)}
  }
  return <form className="auth-form" onSubmit={submit}>
    <label htmlFor="recovery-email">Email</label><input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} disabled={sent||pending||!ready}/>
    {sent&&<>
      <p>If an account exists for that email, a recovery code was sent.</p>
      <label htmlFor="recovery-code">Recovery code</label><input id="recovery-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}|[0-9]{8}" maxLength={8} required value={code} onChange={event=>setCode(event.target.value)} disabled={pending}/>
      <label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event=>setPassword(event.target.value)} disabled={pending}/>
      <label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={event=>setConfirmation(event.target.value)} disabled={pending}/>
    </>}
    {error&&<p role="alert" className="error">{error}</p>}
    <button type="submit" disabled={pending||!ready}>{pending?'Please wait…':sent?'Reset password':'Send recovery code'}</button>
    {sent&&<button type="button" onClick={resendCode} disabled={pending||!ready}>Send a new code</button>}
  </form>
}
