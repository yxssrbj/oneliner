// @vitest-environment jsdom
import {beforeEach,expect,test,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react'
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
async function openComparison() { await screen.findByRole('tab',{name:'Weekly comparison'}); await userEvent.click(screen.getByRole('tab',{name:'Weekly comparison'})) }
beforeEach(()=>{cleanup();vi.clearAllMocks();getUser.mockResolvedValue({data:{user:{id}},error:null});authChanged=undefined;onAuthStateChange.mockImplementation(callback=>{authChanged=callback;return {data:{subscription:{unsubscribe:vi.fn()}}}});vi.stubGlobal('fetch',fetchMock);vi.spyOn(window,'confirm').mockReturnValue(true)
Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true}})
Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false;this.dispatchEvent(new Event('close'))}})
fetchMock.mockImplementation((url:string)=>url==='/api/profile'?response({displayName:'Owner'}):url==='/api/groups'?response({groups:[{id,name:'Friends',ownerId:id}]}):url.includes('/metrics')?response({metrics:[{displayName:'Owner',totalR:1,winRate:1/3,completedCount:3}]}):response({group:{id,name:'Friends',ownerId:id},members:[{userId:id,displayName:'Owner'},{userId:'other',displayName:'Member'}],inviteToken:id,viewerId:id}))})
test('shows only aggregate columns and owner controls',async()=>{
render(<GroupMetrics initialGroup={id}/>);
await screen.findByRole('tab',{name:'Chat'})
expect(screen.getByRole('tab',{name:'Chat'})).toHaveAttribute('aria-selected','true')
expect(screen.queryByRole('table',{name:'Weekly group comparison'})).not.toBeInTheDocument()
await userEvent.click(screen.getByRole('tab',{name:'Weekly comparison'}))
expect(screen.queryByRole('log',{name:'Group conversation'})).not.toBeInTheDocument()
expect(await screen.findByRole('table',{name:'Weekly group comparison'})).toHaveTextContent('Owner')
expect(screen.getAllByRole('heading',{name:'Weekly comparison'})).toHaveLength(1)
await userEvent.click(screen.getByRole('button',{name:'Group options'}))
await userEvent.click(screen.getByRole('button',{name:'Share group'}))
expect((screen.getByLabelText('Invite friends') as HTMLInputElement).value).toContain(`/friends/invite/${id}`)
expect(screen.getByRole('button',{name:'Remove Member'})).toBeVisible()
expect(screen.getAllByText(/Self-reported/).length).toBeGreaterThan(0)
expect(screen.queryByText(/unfinished/i)).not.toBeInTheDocument()
})
test('owner can rename a group from the options menu',async()=>{
render(<GroupMetrics initialGroup={id}/>)
await screen.findByRole('tab',{name:'Chat'})
await userEvent.click(screen.getByRole('button',{name:'Group options'}))
await userEvent.click(screen.getByRole('button',{name:'Rename group'}))
await userEvent.clear(screen.getByLabelText('Group name'))
await userEvent.type(screen.getByLabelText('Group name'),'New name')
await userEvent.click(screen.getByRole('button',{name:'Save name'}))
await waitFor(()=>expect(fetchMock).toHaveBeenCalledWith(`/api/groups/${id}`,expect.objectContaining({method:'POST',body:JSON.stringify({action:'rename',name:'New name'})})))
})
test('group options close after clicking outside the menu',async()=>{
render(<GroupMetrics initialGroup={id}/>)
await screen.findByRole('tab',{name:'Chat'})
await userEvent.click(screen.getByRole('button',{name:'Group options'}))
expect(screen.getByRole('button',{name:'Rename group'})).toBeVisible()
await userEvent.click(screen.getByRole('tab',{name:'Chat'}))
expect(screen.queryByRole('button',{name:'Rename group'})).not.toBeInTheDocument()
})
test('arrow keys switch and focus the two group tabs',async()=>{
render(<GroupMetrics initialGroup={id}/>)
const chat=await screen.findByRole('tab',{name:'Chat'})
chat.focus()
fireEvent.keyDown(chat,{key:'ArrowRight'})
const comparison=screen.getByRole('tab',{name:'Weekly comparison'})
expect(comparison).toHaveFocus()
expect(comparison).toHaveAttribute('aria-selected','true')
expect(chat).toHaveAttribute('tabindex','-1')
})
test('account change closes the old owners rename dialog',async()=>{
render(<GroupMetrics initialGroup={id}/>)
await screen.findByRole('tab',{name:'Chat'})
await userEvent.click(screen.getByRole('button',{name:'Group options'}))
await userEvent.click(screen.getByRole('button',{name:'Rename group'}))
expect(screen.getByRole('dialog',{name:'Rename group'})).toBeVisible()
act(()=>authChanged?.('SIGNED_IN',{user:{id:'another-user'}}))
await waitFor(()=>expect(screen.queryByLabelText('Group name')).not.toBeInTheDocument())
})
test('rename refusal clears the prior groups private details',async()=>{
let denied=false
fetchMock.mockImplementation((url:string,options?:RequestInit)=>{
  if(options?.method==='POST'){denied=true;return response({error:'Group unavailable.'},403)}
  if(url==='/api/groups')return response({groups:denied?[]:[{id,name:'Friends',ownerId:id}]})
  if(url.includes('/metrics'))return response({metrics:[]})
  return response({group:{id,name:'Friends',ownerId:id},members:[],inviteToken:id,viewerId:id})
})
render(<GroupMetrics initialGroup={id}/>)
await screen.findByRole('tab',{name:'Chat'})
await userEvent.click(screen.getByRole('button',{name:'Group options'}))
await userEvent.click(screen.getByRole('button',{name:'Rename group'}))
await userEvent.click(screen.getByRole('button',{name:'Save name'}))
await waitFor(()=>expect(screen.queryByRole('button',{name:'Friends'})).not.toBeInTheDocument())
expect(screen.queryByLabelText('Group name')).not.toBeInTheDocument()
})
test('places the comparison between the group list and member list',async()=>{
render(<GroupMetrics initialGroup={id}/>);
expect(await screen.findByRole('log',{name:'Group conversation'})).toBeVisible()
await openComparison()
expect(await screen.findByRole('table',{name:'Weekly group comparison'})).toBeVisible()
expect(screen.getByRole('navigation',{name:'Your groups'})).toContainElement(screen.getByRole('button',{name:'Friends'}))
const members=screen.getByRole('complementary',{name:'Group members'})
expect(members).toHaveTextContent('Owner')
expect(members).toHaveTextContent('Member')
expect(members).toHaveTextContent('You')
expect(members).toHaveTextContent('Group owner')
})
test('token refresh keeps an unsent group draft',async()=>{
render(<GroupMetrics initialGroup={id}/>);
await screen.findByRole('log',{name:'Group conversation'})
await userEvent.type(screen.getByLabelText('Message'),'Keep this draft')
act(()=>authChanged?.('TOKEN_REFRESHED',{user:{id}}))
expect(await screen.findByLabelText('Message')).toHaveValue('Keep this draft')
})
test('opens group creation from the left rail instead of showing the form all the time',async()=>{
render(<GroupMetrics initialGroup={id}/>);
await openComparison(); await screen.findByRole('table')
expect(screen.queryByLabelText('Group name')).not.toBeInTheDocument()
await userEvent.click(screen.getByRole('button',{name:'Create group'}))
expect(screen.getByRole('dialog',{name:'Create group'})).toContainElement(screen.getByLabelText('Group name'))
})
test('shows unavailable win rate for a week with no completed trades',async()=>{
fetchMock.mockImplementation((url:string)=>url==='/api/profile'?response({displayName:'Owner'}):url==='/api/groups'?response({groups:[{id,name:'Friends',ownerId:id}]}):url.includes('/metrics')?response({metrics:[{displayName:'Owner',totalR:0,winRate:null,completedCount:0}]}):response({group:{id,name:'Friends',ownerId:id},members:[{userId:id,displayName:'Owner'}],inviteToken:id,viewerId:id}))
render(<GroupMetrics initialGroup={id}/>);
await openComparison(); const table=await screen.findByRole('table',{name:'Weekly group comparison'})
expect(table).toHaveTextContent('—')
expect(table).not.toHaveTextContent('0.0%')
})
test('does not report an empty group list while the list request is pending',async()=>{
let finish:(value:Response)=>void=()=>{}
fetchMock.mockImplementation((url:string)=>url==='/api/groups'?new Promise<Response>(resolve=>{finish=resolve}):response({displayName:'Owner'}))
render(<GroupMetrics/>);
await waitFor(()=>expect(fetchMock).toHaveBeenCalledWith('/api/groups',expect.anything()))
expect(screen.queryByRole('heading',{name:'No groups yet'})).not.toBeInTheDocument()
expect(screen.getByRole('status')).toHaveTextContent('Loading groups')
await act(async()=>{finish(Response.json({groups:[]}))})
expect(await screen.findByRole('heading',{name:'No groups yet'})).toBeVisible()
})
test('focus clears inaccessible group content',async()=>{
render(<GroupMetrics initialGroup={id}/>);await openComparison(); await screen.findByRole('table')
fetchMock.mockImplementation((url:string)=>url==='/api/groups'?response({groups:[]}):response({error:'Group unavailable.'},404))
fireEvent.focus(window)
await waitFor(()=>expect(screen.queryByRole('table')).not.toBeInTheDocument())
expect(screen.queryByLabelText('Invite friends')).not.toBeInTheDocument()
})
test('failed create preserves input and allows retry',async()=>{
render(<GroupForm onCreated={vi.fn()}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Create group'})).toBeEnabled())
fetchMock.mockResolvedValue(Response.json({error:'Try again.'},{status:503}))
await userEvent.type(screen.getByLabelText('Group name'),'Friends')
await userEvent.click(screen.getByRole('button',{name:'Create group'}))
expect(await screen.findByRole('alert')).toHaveTextContent('Try again')
expect(screen.getByLabelText('Group name')).toHaveValue('Friends')
expect(screen.getByRole('button',{name:'Create group'})).toBeEnabled()
})
test('group creation uses the account identity without asking for another display name',async()=>{
render(<GroupForm onCreated={vi.fn()}/>);
await screen.findByRole('button',{name:'Create group'})
expect(screen.getByLabelText('Group name')).toBeVisible()
expect(screen.queryByLabelText('Display name')).not.toBeInTheDocument()
})
test('missing account identity points to Settings before group creation',async()=>{
fetchMock.mockImplementation((url:string)=>url==='/api/profile'?response({displayName:null}):response({groups:[]}))
render(<GroupForm onCreated={vi.fn()}/>);
expect(await screen.findByRole('link',{name:/Settings/})).toHaveAttribute('href','/settings')
expect(screen.getByRole('button',{name:'Create group'})).toBeDisabled()
})
test('joining requires explicit action after sharing disclosure and recovers from failure',async()=>{
render(<GroupForm inviteToken={id}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Join group'})).toBeEnabled())
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
await openComparison()
await userEvent.click(screen.getByRole('button',{name:'Previous week'}))
expect(await screen.findByRole('table')).toHaveTextContent('Current')
complete(Response.json({metrics:[{displayName:'Stale',totalR:99,winRate:1,completedCount:1}]}))
await waitFor(()=>expect(screen.getByRole('table')).not.toHaveTextContent('Stale'))
})

test('discard a completed join after the invite form unmounts',async()=>{
let finish:(value:Response)=>void=()=>{}
const view=render(<GroupForm inviteToken={id}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Join group'})).toBeEnabled())
fetchMock.mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve}))
await userEvent.click(screen.getByRole('button',{name:'Join group'}))
view.unmount();finish(Response.json({groupId:id}))
await new Promise(resolve=>setTimeout(resolve,0))
expect(replace).not.toHaveBeenCalled()
})
test('authorization loss clears private group names as well as summaries',async()=>{
render(<GroupMetrics initialGroup={id}/>);await openComparison(); await screen.findByRole('table')
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
render(<GroupMetrics initialGroup={id}/>);await openComparison(); await screen.findByRole('table')
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
render(<GroupMetrics initialGroup={id}/>);await openComparison(); await screen.findByRole('table')
fetchMock.mockImplementation((url:string)=>url==='/api/profile'?response({displayName:'Owner'}):url==='/api/groups'?response({groups:[]}):response({error:'Group unavailable.'},404))
fetchMock.mockClear();fireEvent.focus(window)
expect(await screen.findByText('Create a group or open an invite link to compare weekly results.')).toBeVisible()
expect(screen.queryByRole('table')).not.toBeInTheDocument()
expect(screen.queryByRole('button',{name:'Previous week'})).not.toBeInTheDocument()
expect(fetchMock.mock.calls.some(([url])=>url.includes(`/api/groups/${id}`))).toBe(false)
expect(window.location.search).toBe('')
})
test.each([401,403,404])('action authorization denial %s clears all stale group names',async(status)=>{
render(<GroupMetrics initialGroup={id}/>);await openComparison(); await screen.findByRole('table')
fetchMock.mockResolvedValueOnce(Response.json({error:'Group unavailable.'},{status}))
await userEvent.click(screen.getByRole('button',{name:'Group options'})); await userEvent.click(screen.getByRole('button',{name:'Delete group'}))
expect(await screen.findByRole('alert')).toHaveTextContent('Group unavailable')
expect(screen.queryByRole('button',{name:'Friends'})).not.toBeInTheDocument()
expect(screen.queryByRole('table')).not.toBeInTheDocument()
expect(screen.queryByRole('button',{name:'Previous week'})).not.toBeInTheDocument()
})
test.each(['friends','invite'])('%s form revalidates identity before allowing writes',async(surface)=>{
render(surface==='friends'?<GroupMetrics initialGroup={id}/>:<GroupForm inviteToken={id}/>)
const action=surface==='friends'?'Create group':'Join group'
if(surface==='friends')await userEvent.click(screen.getByRole('button',{name:'Create group'}))
const actionButton=()=>surface==='friends'?within(screen.getByRole('dialog',{name:'Create group'})).getByRole('button',{name:action}):screen.getByRole('button',{name:action})
await waitFor(()=>expect(actionButton()).toBeEnabled())
getUser.mockResolvedValue({data:{user:{id:otherId}},error:null})
fetchMock.mockImplementation((url:string)=>url==='/api/profile'?response({displayName:null}):url==='/api/groups'?response({groups:[]}):response({error:'Group unavailable.'},404))
if(surface==='friends')fireEvent.focus(window)
else fireEvent(document,new Event('visibilitychange'))
await waitFor(()=>expect(actionButton()).toBeDisabled())
expect(await screen.findByRole('link',{name:/Settings/})).toHaveAttribute('href','/settings')
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
expect(screen.getByRole('button',{name:'Join group'})).toBeDisabled()
})
test.each(['create','join'])('a previous-session %s response cannot change the new session',async(kind)=>{
const onCreated=vi.fn()
render(<GroupForm {...(kind==='join'?{inviteToken:id}:{onCreated})}/>)
const action=kind==='create'?'Create group':'Join group'
await waitFor(()=>expect(screen.getByRole('button',{name:action})).toBeEnabled())
if(kind==='create')await userEvent.type(screen.getByLabelText('Group name'),'Old account group')
let finish:(value:Response)=>void=()=>{}
fetchMock.mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve}))
await userEvent.click(screen.getByRole('button',{name:action}))
getUser.mockResolvedValue({data:{user:{id:otherId}},error:null})
fetchMock.mockImplementation(()=>response({displayName:null}))
fireEvent.focus(window)
await waitFor(()=>expect(screen.getByRole('button',{name:action})).toBeDisabled())
await act(async()=>{finish(Response.json({groupId:id}))})
expect(replace).not.toHaveBeenCalled();expect(onCreated).not.toHaveBeenCalled()
})
test('same-account profile revalidation failure keeps the group name draft',async()=>{
render(<GroupForm onCreated={vi.fn()}/>);
await waitFor(()=>expect(screen.getByRole('button',{name:'Create group'})).toBeEnabled())
await userEvent.type(screen.getByLabelText('Group name'),'Draft group')
fetchMock.mockResolvedValue(Response.json({error:'Try again.'},{status:503}))
fireEvent.focus(window)
expect(await screen.findByRole('alert')).toHaveTextContent(/Try again|Could not load/)
expect(screen.getByLabelText('Group name')).toHaveValue('Draft group')
expect(screen.queryByRole('link',{name:/Settings/})).not.toBeInTheDocument()
expect(screen.getByRole('button',{name:'Try again'})).toBeVisible()
fetchMock.mockResolvedValue(Response.json({displayName:'Owner'}))
await userEvent.click(screen.getByRole('button',{name:'Try again'}))
await waitFor(()=>expect(screen.getByRole('button',{name:'Create group'})).toBeEnabled())
expect(screen.getByLabelText('Group name')).toHaveValue('Draft group')
})
test('session change revalidates comparison and form together',async()=>{
render(<GroupMetrics initialGroup={id}/>);await openComparison(); await screen.findByRole('table')
getUser.mockResolvedValue({data:{user:{id:otherId}},error:null})
fetchMock.mockImplementation((url:string)=>url==='/api/profile'?response({displayName:null}):url==='/api/groups'?response({groups:[]}):response({error:'Group unavailable.'},404))
act(()=>authChanged?.('SIGNED_IN',{user:{id:otherId}}))
await waitFor(()=>expect(screen.queryByRole('table')).not.toBeInTheDocument())
expect(screen.queryByRole('button',{name:'Friends'})).not.toBeInTheDocument()
expect(screen.queryByRole('table')).not.toBeInTheDocument()
})
