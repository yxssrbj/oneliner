// @vitest-environment jsdom
import {beforeEach,expect,test,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import GroupMetrics from './group-metrics'
import GroupForm from './group-form'
const {replace,refresh}=vi.hoisted(()=>({replace:vi.fn(),refresh:vi.fn()}))
vi.mock('next/navigation',()=>({useRouter:()=>({replace,refresh})}))
const id='50000000-0000-0000-0000-000000000001'
const fetchMock=vi.fn()
const response=(data:unknown,status=200)=>Promise.resolve(Response.json(data,{status}))
beforeEach(()=>{cleanup();vi.clearAllMocks();vi.stubGlobal('fetch',fetchMock);vi.spyOn(window,'confirm').mockReturnValue(true)
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
await screen.findByRole('alert')
expect(screen.queryByRole('button',{name:'Friends'})).not.toBeInTheDocument()
})
