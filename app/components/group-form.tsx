'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export const sharingDisclosure = 'Joining shares your display name, weekly total R, win rate, and completed count with current members. Results are self-reported. Your individual trades and notes stay private.'

export default function GroupForm({inviteToken,onCreated,onProfileSaved}: {inviteToken?:string;onCreated?:(id:string)=>void;onProfileSaved?:()=>void}) {
  const router = useRouter()
  const mutationRef = useRef<AbortController|null>(null)
  useEffect(()=>()=>mutationRef.current?.abort(),[])
  const [displayName,setDisplayName] = useState('')
  const [name,setName] = useState('')
  const [profileReady,setProfileReady] = useState(false)
  const [pending,setPending] = useState(false)
  const [error,setError] = useState('')
  const [saved,setSaved] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/profile',{cache:'no-store',signal:controller.signal}).then(async response => {
      if (!response.ok) throw new Error('Could not load display name. Try saving it below.')
      const data = await response.json()
      if (!controller.signal.aborted) { setDisplayName(data.displayName ?? ''); setProfileReady(!!data.displayName) }
    }).catch(error => { if (!controller.signal.aborted) setError(error.message) })
    return () => controller.abort()
  },[])
  async function submit(event:FormEvent,kind:'profile'|'create'|'join') {
    event.preventDefault();setPending(true);setError('');setSaved(false)
    const controller=new AbortController();mutationRef.current=controller
    try {
      const response = await fetch(kind==='profile'?'/api/profile':kind==='create'?'/api/groups':'/api/groups/join',{
        signal:controller.signal,method:kind==='profile'?'PUT':'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(kind==='profile'?{displayName}:kind==='create'?{name}:{token:inviteToken}),
      })
      const data = await response.json()
      if (controller.signal.aborted) return
      if (!response.ok) throw new Error(data.error || 'Could not save. Try again.')
      if (kind==='profile') {setProfileReady(true);setSaved(true);onProfileSaved?.()}
      else if (kind==='create') {setName('');onCreated?.(data.groupId)}
      else {router.replace(`/friends?group=${data.groupId}`);router.refresh()}
    } catch(error) {if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Could not save. Try again.')}
    finally {if(!controller.signal.aborted)setPending(false)}
  }
  return <div className="group-forms">
    <form className="group-form" onSubmit={event=>submit(event,'profile')}>
      <label htmlFor="display-name">Display name</label>
      <input id="display-name" required maxLength={80} value={displayName} onChange={event=>{setDisplayName(event.target.value);setSaved(false)}} disabled={pending}/>
      <button disabled={pending}>Save display name</button>
      {saved&&<p role="status">Display name saved.</p>}
    </form>
    {inviteToken ? <form className="group-form" onSubmit={event=>submit(event,'join')} aria-label="Group sharing consent">
      <p id="sharing-disclosure">{sharingDisclosure}</p>
      {!profileReady&&<p>Save a display name before joining.</p>}
      <button disabled={pending||!profileReady} aria-describedby="sharing-disclosure">Join group</button>
    </form> : <form className="group-form" onSubmit={event=>submit(event,'create')}>
      <label htmlFor="group-name">Group name</label>
      <input id="group-name" required maxLength={80} value={name} onChange={event=>setName(event.target.value)} disabled={pending}/>
      {!profileReady&&<p>Save a display name before creating a group.</p>}
      <button disabled={pending||!profileReady}>Create group</button>
    </form>}
    {error&&<p role="alert" className="error">{error}</p>}
  </div>
}
