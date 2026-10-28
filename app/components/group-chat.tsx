'use client'

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

export type ChatDraft = { text: string; image: File | null }
type Message = { id: string; senderId: string | null; displayName: string; body: string | null; imageType: string | null; createdAt: string }
type Props = { groupId: string; viewerId: string; draft: ChatDraft; onDraftChange: Dispatch<SetStateAction<ChatDraft>>; onAccessLost: () => void }

export default function GroupChat({ groupId, viewerId, draft, onDraftChange, onAccessLost }: Props) {
  const [history, setHistory] = useState<{messages:Message[];hasOlder:boolean;olderExhausted:boolean}>({messages:[],hasOlder:false,olderExhausted:false})
  const { messages, hasOlder } = history
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [olderPending, setOlderPending] = useState(false)
  const [preview, setPreview] = useState('')
  const [failedImages, setFailedImages] = useState<string[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const accessLostRef = useRef(onAccessLost)
  useEffect(() => { accessLostRef.current = onAccessLost }, [onAccessLost])

  const read = useCallback(async (url: string, signal?: AbortSignal): Promise<Message[]> => {
    const response = await fetch(url, { cache: 'no-store', signal })
    const data = await response.json()
    if ([401,403,404].includes(response.status)) accessLostRef.current()
    if (!response.ok) throw new Error(data.error || 'Could not load messages. Try again.')
    if (!Array.isArray(data.messages)) throw new Error('Could not load messages. Try again.')
    return data.messages
  }, [])
  const latest = useCallback(async (signal?: AbortSignal) => {
    if (document.visibilityState === 'hidden') return
    try {
      const page = await read(`/api/groups/${groupId}/messages`, signal)
      if (signal?.aborted) return
      setHistory(current => {
        const gap = current.messages.length > 0 && page.length === 50 && !page.some(item => current.messages.some(old => old.id === item.id))
        if (gap) return {messages:page,hasOlder:true,olderExhausted:false}
        const known = new Set(page.map(item => item.id))
        return { ...current,
          messages:[...page, ...current.messages.filter(item => !known.has(item.id))],
          hasOlder:current.olderExhausted ? false : page.length === 50,
        }
      })
      setError('')
    } catch (caught) {
      if (!signal?.aborted) setError(caught instanceof Error ? caught.message : 'Could not load messages. Try again.')
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [groupId, read])

  useEffect(() => {
    const controller = new AbortController()
    // Fetch updates state only after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void latest(controller.signal)
    const timer = window.setInterval(() => void latest(controller.signal), 5000)
    const visible = () => { if (document.visibilityState === 'visible') void latest(controller.signal) }
    document.addEventListener('visibilitychange', visible)
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange',visible) }
  }, [latest])
  useEffect(() => {
    // The browser URL exists only while the selected draft picture exists.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!draft.image) { setPreview(''); return }
    const url = URL.createObjectURL(draft.image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [draft.image])
  useEffect(() => { if (!loading) listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight }) }, [loading])

  async function loadOlder() {
    const oldest = messages.at(-1)
    if (!oldest) return
    setOlderPending(true)
    setError('')
    try {
      const page = await read(`/api/groups/${groupId}/messages?before=${encodeURIComponent(oldest.createdAt)}&beforeId=${oldest.id}`)
      setHistory(current => {
        const known = new Set(current.messages.map(item => item.id))
        return {...current,messages:[...current.messages, ...page.filter(item => !known.has(item.id))],hasOlder:page.length===50,olderExhausted:page.length<50}
      })
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load older messages.') }
    finally { setOlderPending(false) }
  }
  async function send() {
    if (pending || (!draft.text.trim() && !draft.image)) return
    const submitted = draft
    setPending(true)
    setError('')
    const form = new FormData()
    form.set('text', draft.text)
    if (draft.image) form.set('image', draft.image)
    try {
      const response = await fetch(`/api/groups/${groupId}/messages`, { method: 'POST', body: form })
      const data = await response.json()
      if ([401,403,404].includes(response.status)) accessLostRef.current()
      if (!response.ok) throw new Error(data.error || 'Could not send message. Try again.')
      onDraftChange(current => current.text === submitted.text && current.image === submitted.image ? { text: '', image: null } : current)
      await latest()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not send message. Try again.') }
    finally { setPending(false) }
  }

  return <div className="group-chat">
    <div className="group-chat-title"><strong>Conversation</strong><span>Only members can read or send here</span></div>
    <div className="group-chat-log" role="log" aria-label="Group conversation" ref={listRef}>
      {hasOlder && <button type="button" disabled={olderPending} onClick={() => void loadOlder()}>{olderPending ? 'Loading…' : 'Load older messages'}</button>}
      {loading && <p role="status">Loading conversation…</p>}
      {!loading && messages.length === 0 && <p className="group-chat-empty">Start the conversation. Share a thought or a chart picture.</p>}
      {[...messages].reverse().map(message => <article className="group-chat-message" key={message.id}>
        <span className="group-member-avatar" aria-hidden="true">{message.displayName.slice(0,2).toUpperCase()}</span>
        <div><div className="group-chat-meta"><strong>{message.displayName}{message.senderId === viewerId ? ' · you' : ''}</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time></div>
          {message.body && <p>{message.body}</p>}
          {message.imageType && (failedImages.includes(message.id) ? <p role="alert">Could not load picture.</p> : <img src={`/api/groups/${groupId}/messages/${message.id}/image`} alt={`Picture shared by ${message.displayName}`} onError={() => setFailedImages(current => [...current,message.id])} />)}
        </div>
      </article>)}
    </div>
    <div className="group-chat-composer">
      {error && <p role="alert" className="error">{error}</p>}
      {preview && <div className="group-chat-attachment"><img src={preview} alt="Picture ready to send" /><span>{draft.image?.name}</span><button type="button" onClick={() => onDraftChange({...draft,image:null})}>Remove picture</button></div>}
      <label htmlFor="group-message">Message</label>
      <textarea id="group-message" maxLength={2000} value={draft.text} onChange={event => onDraftChange({...draft,text:event.target.value})} placeholder="Share an idea, a lesson, or a chart…" onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void send() } }} />
      <div className="group-chat-actions"><label className="group-chat-file">Add picture<input aria-label="Add picture" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file=event.target.files?.[0]; if (file) onDraftChange({...draft,image:file}); event.target.value='' }} /></label><span>JPEG, PNG or WebP · 1 MB max</span><button type="button" disabled={pending || (!draft.text.trim() && !draft.image)} onClick={() => void send()}>{pending ? 'Sending…' : 'Send message'}</button></div>
    </div>
  </div>
}
