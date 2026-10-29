// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import GroupChat from './group-chat'

const groupId = '60000000-0000-0000-0000-000000000001'
const viewerId = '60000000-0000-0000-0000-000000000002'
const fetchMock = vi.fn()
const onDraftChange = vi.fn()
const draft = { text: '', image: null }
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch',fetchMock); fetchMock.mockResolvedValue(Response.json({messages:[]})) })
afterEach(() => cleanup())

test('loads chronological conversation and keeps the composer visible', async () => {
  fetchMock.mockResolvedValue(Response.json({messages:[
    {id:'2',senderId:viewerId,displayName:'Me',body:'new',createdAt:'2026-10-28T10:01:00Z',imageType:null},
    {id:'1',senderId:'other',displayName:'Friend',body:'old',createdAt:'2026-10-28T10:00:00Z',imageType:null},
  ]}))
  render(<GroupChat groupId={groupId} viewerId={viewerId} draft={draft} onDraftChange={onDraftChange} onAccessLost={vi.fn()} />)
  expect(await screen.findByText('old')).toBeVisible()
  expect(screen.getByText('new')).toBeVisible()
  expect(screen.getByRole('log').textContent?.indexOf('old')).toBeLessThan(screen.getByRole('log').textContent?.indexOf('new') ?? 0)
  expect(screen.getByLabelText('Message')).toBeVisible()
  expect(screen.getByLabelText('Attach picture')).toHaveAttribute('type','file')
})
test('separates conversation days and marks the current user', async () => {
  fetchMock.mockResolvedValue(Response.json({messages:[
    {id:'3',senderId:viewerId,displayName:'Me',body:'today',createdAt:'2026-10-28T10:01:00Z',imageType:null},
    {id:'2',senderId:'other',displayName:'Friend',body:'yesterday later',createdAt:'2026-10-27T10:01:00Z',imageType:null},
    {id:'1',senderId:'other',displayName:'Friend',body:'yesterday earlier',createdAt:'2026-10-27T10:00:00Z',imageType:null},
  ]}))
  render(<GroupChat groupId={groupId} viewerId={viewerId} draft={draft} onDraftChange={onDraftChange} onAccessLost={vi.fn()} />)
  expect(await screen.findByText('today')).toBeVisible()
  expect(screen.getAllByText(/Tuesday, October 27|Wednesday, October 28/)).toHaveLength(2)
  expect(screen.getByText('you')).toBeVisible()
})
test('failed send retains text and shows an error', async () => {
  fetchMock.mockImplementation((url:string,options?:RequestInit) => options?.method === 'POST'
    ? Promise.resolve(Response.json({error:'Could not send.'},{status:503}))
    : Promise.resolve(Response.json({messages:[]})))
  const changed = vi.fn()
  const {rerender} = render(<GroupChat groupId={groupId} viewerId={viewerId} draft={{text:'Hello',image:null}} onDraftChange={changed} onAccessLost={vi.fn()} />)
  await userEvent.click(screen.getByRole('button',{name:'Send'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not send')
  expect(screen.getByLabelText('Message')).toHaveValue('Hello')
  expect(changed).not.toHaveBeenCalledWith({text:'',image:null})
  rerender(<GroupChat groupId={groupId} viewerId={viewerId} draft={{text:'Hello',image:null}} onDraftChange={changed} onAccessLost={vi.fn()} />)
})
test('successful send clears draft only after the server confirms it', async () => {
  let release:(response:Response)=>void = () => {}
  fetchMock.mockImplementation((url:string,options?:RequestInit) => options?.method === 'POST'
    ? new Promise<Response>(resolve => { release=resolve })
    : Promise.resolve(Response.json({messages:[]})))
  render(<GroupChat groupId={groupId} viewerId={viewerId} draft={{text:'Hello',image:null}} onDraftChange={onDraftChange} onAccessLost={vi.fn()} />)
  await userEvent.click(screen.getByRole('button',{name:'Send'}))
  expect(onDraftChange).not.toHaveBeenCalledWith({text:'',image:null})
  release(Response.json({message:{id:'3',senderId:viewerId,body:'Hello',createdAt:new Date().toISOString(),imageType:null}},{status:201}))
  await waitFor(() => expect(onDraftChange).toHaveBeenCalled())
  const update = onDraftChange.mock.lastCall?.[0]
  expect(update({text:'Hello',image:null})).toEqual({text:'',image:null})
})
test('a send cannot erase a newer draft typed while it was pending', async () => {
  let release:(response:Response)=>void = () => {}
  fetchMock.mockImplementation((_url:string,options?:RequestInit) => options?.method === 'POST'
    ? new Promise<Response>(resolve => { release=resolve })
    : Promise.resolve(Response.json({messages:[]})))
  const changed = vi.fn()
  const props = {groupId,viewerId,onDraftChange:changed,onAccessLost:vi.fn()}
  const {rerender} = render(<GroupChat {...props} draft={{text:'First',image:null}} />)
  await userEvent.click(screen.getByRole('button',{name:'Send'}))
  rerender(<GroupChat {...props} draft={{text:'First plus more',image:null}} />)
  release(Response.json({message:{id:'3'}},{status:201}))
  await waitFor(() => expect(changed).toHaveBeenCalled())
  expect(changed).not.toHaveBeenCalledWith({text:'',image:null})
  expect(changed.mock.lastCall?.[0]({text:'First plus more',image:null})).toEqual({text:'First plus more',image:null})
})
test('polling does not offer older history again after the last page', async () => {
  let poll:()=>void = () => {}
  vi.spyOn(window,'setInterval').mockImplementation((callback,delay) => { if (delay === 5000) poll=callback as ()=>void; return 1 as unknown as NodeJS.Timeout })
  const newest = Array.from({length:50},(_,index)=>({id:String(100-index),senderId:viewerId,displayName:'Me',body:String(index),imageType:null,createdAt:new Date(Date.UTC(2026,9,28,0,0,50-index)).toISOString()}))
  const older = [{id:'1',senderId:viewerId,displayName:'Me',body:'Oldest',imageType:null,createdAt:'2026-10-27T00:00:00Z'}]
  fetchMock.mockImplementation((url:string)=>Promise.resolve(Response.json({messages:url.includes('?before=')?older:newest})))
  render(<GroupChat groupId={groupId} viewerId={viewerId} draft={draft} onDraftChange={onDraftChange} onAccessLost={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button',{name:'Load older messages'}))
  expect(await screen.findByText('Oldest')).toBeVisible()
  expect(screen.queryByRole('button',{name:'Load older messages'})).not.toBeInTheDocument()
  await act(async()=>{poll()})
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
  expect(screen.queryByRole('button',{name:'Load older messages'})).not.toBeInTheDocument()
  vi.restoreAllMocks()
})
