'use client'

import {useRef,useState,useSyncExternalStore,type FormEvent} from 'react'
import {isUuid} from '../../lib/groups/validation'
import {createSupabaseBrowserClient} from '../../lib/supabase/client'

export default function RegisterForm({invite}: {invite?:string}) {
  const [email,setEmail]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[code,setCode]=useState('')
  const [sent,setSent]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('')
  const busy=useRef(false)
  const ready=useSyncExternalStore(()=>()=>{},()=>true,()=>false)
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(busy.current || !ready)return
    setError('')
    const chosen=username.trim().toLowerCase()
    if(!sent && !/^[a-z0-9_]{3,24}$/.test(chosen)){setError('Use 3–24 letters, numbers, or underscores for your username.');return}
    if(!sent && password.length<8){setError('Use a password with at least 8 characters.');return}
    if(sent && !/^(?:\d{6}|\d{8})$/.test(code)){setError('Enter the 6 or 8 digit verification code.');return}
    busy.current=true;setPending(true)
    try{
      const client=createSupabaseBrowserClient()
      if(!sent){
        const {error:failure}=await client.auth.signUp({email:email.trim(),password,options:{data:{username:chosen}}})
        if(failure){setError('Could not create the account. Check your details or choose another username.');return}
        setPassword('');setUsername(chosen);setSent(true)
      }else{
        const {data,error:failure}=await client.auth.verifyOtp({email:email.trim(),token:code,type:'email'})
        if(failure || !data.user || !data.session || data.user.id!==data.session.user.id){setError('Invalid or expired code. Check it or request a new one.');return}
        setCode('')
        location.replace(isUuid(invite)?`/friends/invite/${invite}`:'/')
      }
    }catch{setError(sent?'Could not verify the code. Try again.':'Could not create the account. Try again.')}
    finally{busy.current=false;setPending(false)}
  }
  async function resendCode(){
    if(busy.current || !sent)return
    busy.current=true;setPending(true);setError('')
    try{
      const {error:failure}=await createSupabaseBrowserClient().auth.resend({type:'signup',email:email.trim()})
      if(failure){console.error('Signup code resend failed:',failure.message);setError('Could not send a new code. Try again.');return}
      setCode('')
    }catch(error){console.error('Signup code resend failed:',error);setError('Could not send a new code. Try again.')}
    finally{busy.current=false;setPending(false)}
  }
  return <form className="auth-form" onSubmit={submit}>
    {!sent?<>
      <label htmlFor="register-email">Email</label><input id="register-email" type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} disabled={pending||!ready}/>
      <label htmlFor="register-username">Username</label><input id="register-username" autoComplete="username" required minLength={3} maxLength={24} value={username} onChange={event=>setUsername(event.target.value)} disabled={pending||!ready}/>
      <label htmlFor="register-password">Password</label><input id="register-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event=>setPassword(event.target.value)} disabled={pending||!ready}/>
    </>:<>
      <p>Enter the code sent to {email}.</p>
      <label htmlFor="register-code">Verification code</label><input id="register-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}|[0-9]{8}" maxLength={8} required value={code} onChange={event=>setCode(event.target.value)} disabled={pending}/>
    </>}
    {error&&<p role="alert" className="error">{error}</p>}
    <button type="submit" disabled={pending||!ready}>{pending?'Please wait…':sent?'Verify email':'Create account'}</button>
    {sent&&<button type="button" onClick={resendCode} disabled={pending||!ready}>Send a new code</button>}
  </form>
}
