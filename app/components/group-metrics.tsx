'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { weekStartUtc } from '../../lib/trades/week'
import GroupForm from './group-form'

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
  const [selected, setSelected] = useState(initialGroup)
  const [week, setWeek] = useState(() => weekStartUtc(new Date()))
  const [details, setDetails] = useState<Details | null>(null)
  const [metrics, setMetrics] = useState<Metric[] | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [revision, setRevision] = useState(0)
  const controllerRef = useRef<AbortController | null>(null)
  const mutationRef = useRef<AbortController | null>(null)

  const refresh = useCallback(() => {
    controllerRef.current?.abort()
    mutationRef.current?.abort()
    setDetails(null)
    setMetrics(null)
    setGroups([])
    setRevision(value => value + 1)
  }, [])
  useEffect(() => () => mutationRef.current?.abort(), [])
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
      let listed = false
      try {
        const list = await read('/api/groups')
        if (controller.signal.aborted) return
        const available: Group[] = list.groups
        listed = true
        setGroups(available)
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
        setDetails(detail)
        setMetrics(result.metrics)
      } catch (error) {
        if (!controller.signal.aborted) {
          if (!listed) setGroups([])
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
  const owner = details?.viewerId === details?.group.ownerId
  return <div className="groups-workspace">
    <p>Compare weekly summaries with a private group of friends.</p>
    <GroupForm onCreated={select} onProfileSaved={() => setRevision(value => value + 1)} onIdentityChange={refresh} />
    <nav className="group-list" aria-label="Your groups">
      {groups.map(group => <button key={group.id} onClick={() => select(group.id)} aria-pressed={selected === group.id}>{group.name}</button>)}
    </nav>
    {groups.some(group => group.id === selected) && <div className="week-picker">
      <button onClick={() => changeWeek(-1)}>Previous week</button>
      <span>Week of {week}</span>
      <button onClick={() => changeWeek(1)}>Next week</button>
    </div>}
    {error && <div><p role="alert" className="error">{error}</p><button onClick={() => setRevision(value => value + 1)}>Try again</button></div>}
    {details && metrics && <section>
      <h2>{details.group.name}</h2>
      <p>Self-reported weekly results · UTC opening week</p>
      <div className="group-table"><table aria-label="Weekly group comparison">
        <thead><tr><th scope="col">Display name</th><th scope="col">Total R</th><th scope="col">Win rate</th><th scope="col">Completed count</th></tr></thead>
        <tbody>{metrics.map((row, index) => <tr key={index}>
          <th scope="row">{row.displayName}</th><td>{row.totalR.toFixed(2)}R</td>
          <td>{row.winRate === null ? '—' : `${(row.winRate * 100).toFixed(1)}%`}</td><td>{row.completedCount}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="group-controls">{owner ? <>
        <label htmlFor="invite-link">Invite link</label>
        <input id="invite-link" readOnly value={`${typeof window === 'undefined' ? '' : window.location.origin}/friends/invite/${details.inviteToken}`} />
        <button disabled={pending} onClick={() => act('rotate-invite')}>Replace invite link</button>
        {details.members.filter(member => member.userId !== details.viewerId).map(member =>
          <button disabled={pending} key={member.userId} onClick={() => act('remove', member.userId)}>Remove {member.displayName}</button>)}
        <button disabled={pending} onClick={() => act('close')}>Close group</button>
      </> : <button disabled={pending} onClick={() => act('leave')}>Leave group</button>}</div>
    </section>}
    {!selected && groups.length === 0 && <p>No groups yet. Create one or open an invite link.</p>}
  </div>
}
