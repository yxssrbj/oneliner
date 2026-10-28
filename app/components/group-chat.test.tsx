// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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
})
test('failed send retains text and shows an error', async () => {
  fetchMock.mockImplementation((url:string,options?:RequestInit) => options?.method === 'POST'
    ? Promise.resolve(Response.json({error:'Could not send.'},{status:503}))
    : Promise.resolve(Response.json({messages:[]})))
  const changed = vi.fn()
  const {rerender} = render(<GroupChat groupId={groupId} viewerId={viewerId} draft={{text:'Hello',image:null}} onDraftChange={changed} onAccessLost={vi.fn()} />)
  await userEvent.click(screen.getByRole('button',{name:'Send message'}))
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
  await userEvent.click(screen.getByRole('button',{name:'Send message'}))
  expect(onDraftChange).not.toHaveBeenCalledWith({text:'',image:null})
  release(Response.json({message:{id:'3',senderId:viewerId,body:'Hello',createdAt:new Date().toISOString(),imageType:null}},{status:201}))
  await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith({text:'',image:null}))
})
