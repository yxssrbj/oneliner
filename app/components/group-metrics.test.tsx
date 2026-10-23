// @vitest-environment jsdom
import {beforeEach,expect,test,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import GroupMetrics from './group-metrics'
import GroupForm from './group-form'
const {replace,refresh,getUser,onAuthStateChange}=vi.hoisted(()=>({replace:vi.fn(),refresh:vi.fn(),getUser:vi.fn(),onAuthStateChange:vi.fn()}))
vi.mock('../../lib/supabase/client',()=>({createSupabaseBrowserClient:()=>({auth:{getUser,onAuthStateChange}})}))
let authChanged: ((event:string,session:{user:{id:string}}|null)=>void)|undefined
vi.mock('next/navigation',()=>({useRouter:()=>({replace,refresh})}))
const id='50000000-0000-0000-0000-000000000001'
const fetchMock=vi.fn()
const response=(data:unknown,status=200)=>Promise.resolve(Response.json(data,{status}))
beforeEach(()=>{cleanup();vi.clearAllMocks();getUser.mockResolvedValue({data:{user:{id}},error:null});authChanged=undefined;onAuthStateChange.mockImplementation(callback=>{authChanged=callback;return {data:{subscription:{unsubscribe:vi.fn()}}}});vi.stubGlobal('fetch',fetchMock);vi.spyOn(window,'confirm').mockReturnValue(true)
fetchMock.mockImplementation((url:string)=>url==='/api/profile'?response({displayName:'Owner'}):url==='/api/groups'?response({groups:[{id,name:'Friends',ownerId:id}]}):url.includes('/metrics')?response({metrics:[{displayName:'Owner',totalR:1,winRate:1/3,completedCount:3}]}):response({group:{id,name:'Friends',ownerId:id},members:[{userId:id,displayName:'Owner'},{userId:'other',displayName:'Member'}],inviteToken:id,viewerId:id}))})
test('shows only aggregate columns and owner controls',async()=>{
render(<GroupMetrics initialGroup={id}/>);
expect(await screen.findByRole('table',{name:'Weekly group comparison'})).toHaveTextContent('Owner')
expect((screen.getByLabelText('Invite link') as HTMLInputElement).value).toContain(`/friends/invite/${id}`)
expect(screen.getByRole('button',{name:'Remove Member'})).toBeVisible()
expect(screen.getByText(/Self-reported/)).toBeVisible()
expect(screen.queryByText(/unfinished/i)).not.toBeInTheDocument()
})
test('focus clears inaccessible group content',async()=>{
render(<GroupMetrics initialGroup={id}/>);await screen.findByRole('table')
fetchMock.mockImplementation((url:string)=>url==='/api/groups'?response({groups:[]}):response({error:'Group unavailable.'},404))
fireEvent.focus(window)
await waitFor(()=>expect(screen.queryByRole('table')).not.toBeInTheDocument())
expect(screen.queryByLabelText('Invite link')).not.toBeInTheDocument()
})
test('failed create preserves input and allows retry',async()=>{
render(<GroupForm onCreated={vi.fn()}/>);await screen.findByDisplayValue('Owner')
fetchMock.mockResolvedValue(Response.json({error:'Try again.'},{status:503}))
await userEvent.type(screen.getByLabelText('Group name'),'Friends')
await userEvent.click(screen.getByRole('button',{name:'Create group'}))
expect(await screen.findByRole('alert')).toHaveTextContent('Try again')
expect(screen.getByLabelText('Group name')).toHaveValue('Friends')
expect(screen.getByRole('button',{name:'Create group'})).toBeEnabled()
})
test('joining requires explicit action after sharing disclosure and recovers from failure',async()=>{
render(<GroupForm inviteToken={id}/>);await screen.findByDisplayValue('Owner')
expect(screen.getByText(/win rate/)).toBeVisible();expect(fetchMock.mock.calls.some((call)=>call[0]==='/api/groups/join')).toBe(false)
fetchMock.mockResolvedValueOnce(Response.json({error:'Try again.'},{status:503}))
await userEvent.click(screen.getByRole('button',{name:'Join group'}))
expect(await screen.findByRole('alert')).toHaveTextContent('Try again')
expect(replace).not.toHaveBeenCalled()
fetchMock.mockResolvedValueOnce(Response.json({groupId:id}))
await userEvent.click(screen.getByRole('button',{name:'Join group'}))
expect(replace).toHaveBeenCalledWith(`/friends?group=${id}`)
})
test('ignore stale metrics after changing weeks',async()=>{
let complete:(value:Response)=>void=()=>{}
let requests=0
fetchMock.mockImplementation((url:string)=>url==='/api/groups'?response({groups:[{id,name:'Friends',ownerId:id}]}):url.includes('/metrics')?(++requests===1?new Promise<Response>(resolve=>{complete=resolve}):response({metrics:[{displayName:'Current',totalR:2,winRate:1,completedCount:1}]})):response({group:{id,name:'Friends',ownerId:id},members:[],inviteToken:null,viewerId:id}))
render(<GroupMetrics initialGroup={id}/>);
await waitFor(()=>expect(requests).toBe(1))
// Week controls remain available while a summary loads.
await userEvent.click(screen.getByRole('button',{name:'Previous week'}))
expect(await screen.findByRole('table')).toHaveTextContent('Current')
complete(Response.json({metrics:[{displayName:'Stale',totalR:99,winRate:1,completedCount:1}]}))
await waitFor(()=>expect(screen.getByRole('table')).not.toHaveTextContent('Stale'))
})

test('discard a completed join after the invite form unmounts',async()=>{
let finish:(value:Response)=>void=()=>{}
const view=render(<GroupForm inviteToken={id}/>);await screen.findByDisplayValue('Owner')
fetchMock.mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve}))
await userEvent.click(screen.getByRole('button',{name:'Join group'}))
view.unmount();finish(Response.json({groupId:id}))
await new Promise(resolve=>setTimeout(resolve,0))
expect(replace).not.toHaveBeenCalled()
})
test('authorization loss clears private group names as well as summaries',async()=>{
render(<GroupMetrics initialGroup={id}/>);await screen.findByRole('table')
fetchMock.mockResolvedValue(Response.json({error:'Sign in required.'},{status:401}))
await userEvent.click(screen.getByRole('button',{name:'Previous week'}))
await screen.findAllByRole('alert')
expect(screen.queryByRole('button',{name:'Friends'})).not.toBeInTheDocument()
})

const otherId='50000000-0000-0000-0000-000000000002'
test('removal reconciles selection with other accessible groups and retry keeps the valid list',async()=>{
let removed=false
let failSummary=false
fetchMock.mockImplementation((url:string)=>{
 if(url==='/api/profile')return response({displayName:'Owner'})
 if(url==='/api/groups')return response({groups:removed?[{id:otherId,name:'Remaining',ownerId:id}]:[{id,name:'Friends',ownerId:id},{id:otherId,name:'Remaining',ownerId:id}]})
 if(url.includes(id)&&removed)return response({error:'Group unavailable.'},404)
 if(url.includes('/metrics'))return failSummary?response({error:'Try again.'},503):response({metrics:[{displayName:removed?'Remaining member':'Owner',totalR:0,winRate:null,completedCount:0}]})
 return response({group:{id:removed?otherId:id,name:removed?'Remaining':'Friends',ownerId:id},members:[],inviteToken:id,viewerId:id})
})
render(<GroupMetrics initialGroup={id}/>);await screen.findByRole('table')
removed=true;failSummary=true;fetchMock.mockClear();fireEvent.focus(window)
await screen.findByRole('alert')
expect(screen.queryByRole('button',{name:'Friends'})).not.toBeInTheDocument()
expect(screen.getByRole('button',{name:'Remaining'})).toBeVisible()
failSummary=false
await userEvent.click(screen.getByRole('button',{name:'Try again'}))
expect(await screen.findByRole('table')).toHaveTextContent('Remaining member')
expect(fetchMock.mock.calls.some(([url])=>url.includes(`/api/groups/${id}`))).toBe(false)
expect(window.location.search).toBe(`?group=${otherId}`)
})
test('removal with no remaining groups clears selection and stale requests',async()=>{
render(<GroupMetrics initialGroup={id}/>);await screen.findByRole('table')
fetchMock.mockImplementation((url:string)=>url==='/api/profile'?response({displayName:'Owner'}):url==='/api/groups'?response({groups:[]}):response({error:'Group unavailable.'},404))
fetchMock.mockClear();fireEvent.focus(window)
expect(await screen.findByText('No groups yet. Create one or open an invite link.')).toBeVisible()
expect(screen.queryByRole('table')).not.toBeInTheDocument()
expect(screen.queryByRole('button',{name:'Previous week'})).not.toBeInTheDocument()
expect(fetchMock.mock.calls.some(([url])=>url.includes(`/api/groups/${id}`))).toBe(false)
expect(window.location.search).toBe('')
})
test.each([401,403,404])('action authorization denial %s clears all stale group names',async(status)=>{
render(<GroupMetrics initialGroup={id}/>);await screen.findByRole('table')
fetchMock.mockResolvedValueOnce(Response.json({error:'Group unavailable.'},{status}))
await userEvent.click(screen.getByRole('button',{name:'Close group'}))
expect(await screen.findByRole('alert')).toHaveTextContent('Group unavailable')
expect(screen.queryByRole('button',{name:'Friends'})).not.toBeInTheDocument()
expect(screen.queryByRole('table')).not.toBeInTheDocument()
expect(screen.queryByRole('button',{name:'Previous week'})).not.toBeInTheDocument()
})
test.each(['friends','invite'])('%s form revalidates identity on focus or visibility before allowing writes',async(surface)=>{
render(surface==='friends'?<GroupMetrics initialGroup={id}/>:<GroupForm inviteToken={id}/>)
await screen.findByDisplayValue('Owner')
if(surface==='friends')await screen.findByRole('table')
fetchMock.mockResolvedValueOnce(Response.json({displayName:'Owner'}))
await userEvent.click(screen.getByRole('button',{name:'Save display name'}))
expect(await screen.findByRole('status')).toHaveTextContent('Display name saved')
getUser.mockResolvedValue({data:{user:{id:otherId}},error:null})
fetchMock.mockImplementation((url:string)=>url==='/api/profile'?response({displayName:null}):url==='/api/groups'?response({groups:[]}):response({error:'Group unavailable.'},404))
if(surface==='friends')fireEvent.focus(window)
else fireEvent(document,new Event('visibilitychange'))
await waitFor(()=>expect(screen.getByLabelText('Display name')).toHaveValue(''))
expect(screen.queryByRole('status')).not.toBeInTheDocument()
expect(screen.getByRole('button',{name:surface==='friends'?'Create group':'Join group'})).toBeDisabled()
await userEvent.type(screen.getByLabelText('Display name'),'New account')
fetchMock.mockImplementation((url:string,options?:RequestInit)=>url==='/api/profile'?response({displayName:options?.method==='PUT'?'New account':null}):url==='/api/groups'?response({groups:[]}):response({error:'Group unavailable.'},404))
await userEvent.click(screen.getByRole('button',{name:'Save display name'}))
await waitFor(()=>expect(screen.getByRole('button',{name:surface==='friends'?'Create group':'Join group'})).toBeEnabled())
})
test('a previous-session profile response cannot restore identity after auth changes',async()=>{
let finish:(value:Response)=>void=()=>{}
fetchMock.mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve}))
render(<GroupForm inviteToken={id}/>)
await waitFor(()=>expect(fetchMock).toHaveBeenCalledWith('/api/profile',expect.anything()))
getUser.mockResolvedValue({data:{user:{id:otherId}},error:null})
fetchMock.mockImplementation(()=>response({displayName:null}))
act(()=>authChanged?.('SIGNED_IN',{user:{id:otherId}}))
await waitFor(()=>expect(getUser).toHaveBeenCalledTimes(2))
await act(async()=>{finish(Response.json({displayName:'Previous owner'}))})
expect(screen.getByLabelText('Display name')).toHaveValue('')
expect(screen.getByRole('button',{name:'Join group'})).toBeDisabled()
})
test.each(['create','join'])('a previous-session %s response cannot change the new session',async(kind)=>{
const onCreated=vi.fn()
render(<GroupForm {...(kind==='join'?{inviteToken:id}:{onCreated})}/>)
await screen.findByDisplayValue('Owner')
if(kind==='create')await userEvent.type(screen.getByLabelText('Group name'),'Old account group')
let finish:(value:Response)=>void=()=>{}
fetchMock.mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve}))
await userEvent.click(screen.getByRole('button',{name:kind==='create'?'Create group':'Join group'}))
getUser.mockResolvedValue({data:{user:{id:otherId}},error:null})
fetchMock.mockImplementation(()=>response({displayName:null}))
fireEvent.focus(window)
await waitFor(()=>expect(screen.getByLabelText('Display name')).toHaveValue(''))
await act(async()=>{finish(Response.json({groupId:id}))})
expect(replace).not.toHaveBeenCalled();expect(onCreated).not.toHaveBeenCalled()
expect(screen.getByRole('button',{name:kind==='create'?'Create group':'Join group'})).toBeDisabled()
})
test('same-account profile revalidation failure retains unsaved input and can recover',async()=>{
render(<GroupForm onCreated={vi.fn()}/>);await screen.findByDisplayValue('Owner')
await userEvent.clear(screen.getByLabelText('Display name'))
await userEvent.type(screen.getByLabelText('Display name'),'Draft display name')
await userEvent.type(screen.getByLabelText('Group name'),'Draft group')
fetchMock.mockResolvedValue(Response.json({error:'Try again.'},{status:503}))
fireEvent.focus(window)
expect(await screen.findByRole('alert')).toHaveTextContent(/Try again|Try saving/)
expect(screen.getByLabelText('Display name')).toHaveValue('Draft display name')
expect(screen.getByLabelText('Group name')).toHaveValue('Draft group')
fetchMock.mockResolvedValue(Response.json({displayName:'Draft display name'}))
await userEvent.click(screen.getByRole('button',{name:'Save display name'}))
expect(await screen.findByRole('status')).toHaveTextContent('Display name saved')
})
test('session change revalidates comparison and form together without waiting for focus',async()=>{
render(<GroupMetrics initialGroup={id}/>);await screen.findByRole('table');await screen.findByDisplayValue('Owner')
getUser.mockResolvedValue({data:{user:{id:otherId}},error:null})
fetchMock.mockImplementation((url:string)=>url==='/api/profile'?response({displayName:null}):url==='/api/groups'?response({groups:[]}):response({error:'Group unavailable.'},404))
act(()=>authChanged?.('SIGNED_IN',{user:{id:otherId}}))
await waitFor(()=>expect(screen.getByLabelText('Display name')).toHaveValue(''))
await waitFor(()=>expect(screen.queryByRole('table')).not.toBeInTheDocument())
expect(screen.queryByRole('button',{name:'Friends'})).not.toBeInTheDocument()
})

test('saving an existing display name refreshes the server account area', async () => {
render(<GroupForm/>); await screen.findByDisplayValue('Owner')
await userEvent.clear(screen.getByLabelText('Display name'))
await userEvent.type(screen.getByLabelText('Display name'), 'River')
await userEvent.click(screen.getByRole('button', {name:'Save display name'}))
expect(await screen.findByRole('status')).toHaveTextContent('Display name saved.')
expect(refresh).toHaveBeenCalledTimes(1)
})
