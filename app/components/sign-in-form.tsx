'use client'

import {useEffect,useRef,useState,type FormEvent} from 'react'
import {isUuid} from '../../lib/groups/validation'
import {createSupabaseBrowserClient} from '../../lib/supabase/client'

export default function SignInForm({invite,passwordUpdated=false}:{invite?:string;passwordUpdated?:boolean}={}){
  const [ready,setReady]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState('')
  const [pending,setPending]=useState(false),[error,setError]=useState('')
  const busy=useRef(false)
  useEffect(()=>{
    const {data:{subscription}}=createSupabaseBrowserClient().auth.onAuthStateChange(()=>setReady(true))
    return()=>{setReady(false);subscription.unsubscribe()}
  },[])
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(busy.current || !ready)return
    busy.current=true;setPending(true);setError('')
    try{
      const {data,error:failure}=await createSupabaseBrowserClient().auth.signInWithPassword({email:email.trim(),password})
      if(failure || !data.user || !data.session || data.user.id!==data.session.user.id)throw new Error('Unconfirmed sign-in')
      setPassword('')
      location.replace(isUuid(invite)?`/friends/invite/${invite}`:'/')
    }catch{setError('Could not sign in. Check your email and password.')}
    finally{busy.current=false;setPending(false)}
  }
  return <form className="auth-form" onSubmit={submit}>
    {passwordUpdated&&<p role="status">Password updated. Sign in with your new password.</p>}
    <label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} disabled={pending||!ready}/>
    <label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)} disabled={pending||!ready}/>
    {error&&<p role="alert" className="error">{error}</p>}
    <button type="submit" disabled={pending||!ready}>{pending?'Please wait…':'Sign in'}</button>
  </form>
}
