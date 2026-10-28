'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { weekStartUtc } from '../../lib/trades/week'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import GroupForm from './group-form'
import GroupChat, { type ChatDraft } from './group-chat'

type Group = { id: string; name: string; ownerId: string }
type Details = {
  group: Group
  members: { userId: string; displayName: string }[]
  inviteToken: string | null
  viewerId: string
}
type Metric = { displayName: string; totalR: number; winRate: number | null; completedCount: number }

export default function GroupMetrics({ initialGroup = '' }: { initialGroup?: string }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [selected, setSelected] = useState(initialGroup)
  const [week, setWeek] = useState(() => weekStartUtc(new Date()))
  const [details, setDetails] = useState<Details | null>(null)
  const [metrics, setMetrics] = useState<Metric[] | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const [revision, setRevision] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, ChatDraft>>({})
  const controllerRef = useRef<AbortController | null>(null)
  const mutationRef = useRef<AbortController | null>(null)
  const createDialog = useRef<HTMLDialogElement | null>(null)
  const comparisonRef = useRef<HTMLDivElement | null>(null)
  const lastUserRef = useRef<string | null | undefined>(undefined)

  const refresh = useCallback(() => {
    controllerRef.current?.abort()
    mutationRef.current?.abort()
    setDetails(null)
    setMetrics(null)
    setGroups([])
    setListLoading(true)
    setCopyStatus('')
    setRevision(value => value + 1)
  }, [])
  useEffect(() => () => mutationRef.current?.abort(), [])
  useEffect(() => {
    const { data: { subscription } } = createSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user?.id ?? null
      if (lastUserRef.current !== undefined && lastUserRef.current !== nextUser) setDrafts({})
      lastUserRef.current = nextUser
      refresh()
    })
    return () => subscription.unsubscribe()
  }, [refresh])
  useEffect(() => {
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [refresh])

  useEffect(() => {
    const controller = new AbortController()
    controllerRef.current = controller
    async function read(url: string) {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load groups. Try again.')
      return data
    }
    async function load() {
      setDetails(null)
      setMetrics(null)
      setError('')
      setListLoading(true)
      let listed = false
      try {
        const list = await read('/api/groups')
        if (controller.signal.aborted) return
        const available: Group[] = list.groups
        listed = true
        setGroups(available)
        setListLoading(false)
        const groupId = available.some(group => group.id === selected) ? selected : available[0]?.id || ''
        if (groupId !== selected) {
          setSelected(groupId)
          window.history.replaceState(null, '', groupId ? `/friends?group=${groupId}` : '/friends')
          return
        }
        if (!groupId) return
        const [detail, result] = await Promise.all([
          read(`/api/groups/${groupId}`),
          read(`/api/groups/${groupId}/metrics?weekStart=${week}`),
        ])
        if (controller.signal.aborted) return
        lastUserRef.current = detail.viewerId
        setDetails(detail)
        setMetrics(result.metrics)
      } catch (error) {
        if (!controller.signal.aborted) {
          if (!listed) setGroups([])
          setListLoading(false)
          setDetails(null)
          setMetrics(null)
          setError(error instanceof Error ? error.message : 'Could not load groups. Try again.')
        }
      }
    }
    void load()
    return () => controller.abort()
  }, [selected, week, revision])

  function select(groupId: string) {
    controllerRef.current?.abort()
    mutationRef.current?.abort()
    setDetails(null)
    setMetrics(null)
    setSelected(groupId)
    setCopyStatus('')
    window.history.replaceState(null, '', `/friends?group=${groupId}`)
    setRevision(value => value + 1)
  }
  function changeWeek(offset: number) {
    controllerRef.current?.abort()
    setDetails(null)
    setMetrics(null)
    setWeek(value => new Date(Date.parse(`${value}T00:00:00Z`) + offset * 7 * 86400000).toISOString().slice(0, 10))
  }
  async function act(action: string, memberId?: string) {
    const prompt = action === 'remove' ? 'Remove this member and replace the invite link?'
      : action === 'close' ? 'Close this group? Your journal trades will be kept.'
      : action === 'leave' ? 'Leave this group?'
      : 'Replace the invite link? The old link will stop working.'
    if (!window.confirm(prompt)) return
    const controller = new AbortController()
    mutationRef.current = controller
    setPending(true)
    setError('')
    try {
      const response = await fetch(`/api/groups/${selected}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(memberId ? { memberId } : {}) }), signal: controller.signal,
      })
      const data = await response.json()
      if (controller.signal.aborted) return
      if (!response.ok) {
        if ([401, 403, 404].includes(response.status)) {
          setGroups([])
          setDetails(null)
          setMetrics(null)
          window.history.replaceState(null, '', '/friends')
        }
        throw new Error(data.error || 'Could not save. Try again.')
      }
      setDetails(null)
      setMetrics(null)
      if (action === 'close' || action === 'leave') {
        setSelected('')
        window.history.replaceState(null, '', '/friends')
      }
      setRevision(value => value + 1)
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not save. Try again.')
    } finally { setPending(false) }
  }
  async function copyInvite() {
    if (!details?.inviteToken) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/friends/invite/${details.inviteToken}`)
      setCopyStatus('Invite link copied.')
    } catch {
      setCopyStatus('Could not copy. Select the link and copy it manually.')
    }
  }
  const owner = details?.viewerId === details?.group.ownerId
  return <div className="groups-workspace">
    <aside className="groups-rail">
      <div className="groups-eyebrow">Your circles</div>
      <nav className="group-list" aria-label="Your groups">
        {groups.map(group => <button key={group.id} onClick={() => select(group.id)} aria-label={group.name} aria-pressed={selected === group.id}># &nbsp;{group.name}</button>)}
      </nav>
      <div className="groups-rail-bottom">
        <p>A place to compare the process with your people.</p>
        <button type="button" onClick={() => { setCreateOpen(true); createDialog.current?.showModal() }}>Create group</button>
      </div>
    </aside>
    <section className="groups-main" aria-label="Group conversation">
      {details && <header className="groups-head">
        <div><h2>{details.group.name}</h2><p>Private group · Self-reported results</p></div>
        <div className="groups-head-actions"><button onClick={() => comparisonRef.current?.scrollIntoView?.({behavior:'smooth'})}>Weekly comparison</button>{owner ? <button disabled={pending} onClick={() => act('close')}>Close group</button> : <button disabled={pending} onClick={() => act('leave')}>Leave group</button>}</div>
      </header>}
      {details && <GroupChat key={selected} groupId={selected} viewerId={details.viewerId} draft={drafts[selected] || {text:'',image:null}} onDraftChange={change => setDrafts(current => {
        const draft = current[selected] || {text:'',image:null}
        return {...current,[selected]:typeof change === 'function' ? change(draft) : change}
      })} onAccessLost={refresh} />}
      {details && <div ref={comparisonRef} className="groups-comparison-label"><h3>Weekly comparison</h3><p>Self-reported results for the same opening week</p></div>}
      {groups.some(group => group.id === selected) && <div className="groups-week-picker week-picker">
        <button onClick={() => changeWeek(-1)}>Previous week</button>
        <span>Week of {week} · UTC opening week</span>
        <button onClick={() => changeWeek(1)}>Next week</button>
      </div>}
      {error && <div className="groups-message"><p role="alert" className="error">{error}</p><button onClick={() => setRevision(value => value + 1)}>Try again</button></div>}
      {!error && selected && (!details || !metrics) && <p className="groups-message" role="status">Loading group comparison…</p>}
      {!error && !selected && listLoading && <p className="groups-message" role="status">Loading groups…</p>}
      {!error && !selected && !listLoading && <div className="groups-empty"><h2>No groups yet</h2><p>Create a group or open an invite link to compare weekly results.</p></div>}
      {details && metrics && <div className="groups-results">
        <div className="groups-section-title"><h3>Weekly comparison</h3><span>{metrics.length} {metrics.length === 1 ? 'member' : 'members'}</span></div>
        <div className="group-table"><table aria-label="Weekly group comparison">
          <thead><tr><th scope="col">Display name</th><th scope="col">Total R</th><th scope="col">Win rate</th><th scope="col">Completed trades</th></tr></thead>
          <tbody>{metrics.map((row, index) => <tr key={index}>
            <th scope="row">{row.displayName}</th><td className={row.totalR < 0 ? 'group-negative' : 'group-positive'}>{row.totalR > 0 ? '+' : ''}{row.totalR.toFixed(2)}R</td>
            <td>{row.winRate === null ? '—' : `${(row.winRate * 100).toFixed(1)}%`}</td><td>{row.completedCount}</td>
          </tr>)}</tbody>
        </table></div>
        <p className="groups-disclosure">Only weekly totals are shared. Personal notes and trades stay private.</p>
        {owner && details.inviteToken && <div className="group-controls">
          <label htmlFor="invite-link">Invite friends</label>
          <div className="group-invite-row"><input id="invite-link" readOnly value={`${typeof window === 'undefined' ? '' : window.location.origin}/friends/invite/${details.inviteToken}`} /><button onClick={() => void copyInvite()}>Copy link</button></div>
          <button disabled={pending} onClick={() => act('rotate-invite')}>Replace invite link</button>
          {copyStatus && <p role="status">{copyStatus}</p>}
        </div>}
      </div>}
    </section>
    <aside className="groups-members" aria-label="Group members">
      <div className="groups-eyebrow">Members{details ? ` — ${details.members.length}` : ''}</div>
      {details?.members.map(member => <div className="group-member" key={member.userId}>
        <span className="group-member-avatar" aria-hidden="true">{member.displayName.slice(0, 2).toUpperCase()}</span>
        <div className="group-member-info"><strong>{member.displayName}</strong><small>{member.userId === details.viewerId ? member.userId === details.group.ownerId ? 'You · Group owner' : 'You' : member.userId === details.group.ownerId ? 'Group owner' : 'Member'}</small></div>
        {owner && member.userId !== details.viewerId && <button disabled={pending} onClick={() => act('remove', member.userId)} aria-label={`Remove ${member.displayName}`}>Remove</button>}
      </div>)}
      {details?.members.some(member => member.userId === details.viewerId) && details.group.ownerId === details.viewerId && <p className="groups-member-note">You own this private group.</p>}
    </aside>
    <dialog ref={createDialog} className="group-create-dialog" aria-label="Create group" onClose={() => setCreateOpen(false)}>
      {createOpen && <><div className="group-dialog-head"><h2>A new circle</h2><button type="button" onClick={() => createDialog.current?.close()} aria-label="Close create group">×</button></div>
        <p>Name your private group. Invite friends after it is created.</p>
        <GroupForm onCreated={groupId => { createDialog.current?.close(); select(groupId) }} onIdentityChange={refresh} />
      </>}
    </dialog>
  </div>
}
