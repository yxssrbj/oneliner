import { beforeEach, expect, test, vi } from 'vitest'
import { GET, POST } from './route'
import { GET as details, POST as action } from './[groupId]/route'
import { GET as metrics } from './[groupId]/metrics/route'
import { POST as join } from './join/route'
const { getAuthenticatedUser, rpc } = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn(), rpc: vi.fn() }))
vi.mock('../../../lib/supabase/server', () => ({ getAuthenticatedUser }))
const id = '50000000-0000-0000-0000-000000000001'
const ctx = { params: Promise.resolve({ groupId: id }) }
const request = (body: unknown) => new Request('http://localhost/api/groups', { method: 'POST', body: JSON.stringify(body) })
beforeEach(() => { vi.clearAllMocks(); getAuthenticatedUser.mockResolvedValue({ user: { id }, supabase: { rpc } }); rpc.mockResolvedValue({ data: null, error: null }) })
test('all routes require identity and disable caching', async () => {
  getAuthenticatedUser.mockResolvedValue(null)
  for (const response of await Promise.all([GET(), POST(request({name:'Friends'})), details(request({}),ctx), action(request({action:'leave'}),ctx), metrics(new Request('http://localhost?weekStart=2026-10-19'),ctx), join(request({token:id}))])) {
    expect(response.status).toBe(401); expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  }
})
test('lists and creates caller groups', async () => {
  rpc.mockResolvedValueOnce({ data: [{id,name:'Friends',ownerId:id}], error:null })
  expect(await (await GET()).json()).toEqual({groups:[{id,name:'Friends',ownerId:id}]})
  rpc.mockResolvedValueOnce({data:id,error:null})
  const response = await POST(request({name:' Friends '}))
  expect(response.status).toBe(201); expect(await response.json()).toEqual({groupId:id})
  expect(rpc).toHaveBeenLastCalledWith('create_group',{name:'Friends'})
})
test('rejects invalid create and join fields before calling database', async () => {
  for (const body of [{name:''},{name:'a'.repeat(81)},{name:'Friends',ownerId:id},null,[]]) expect((await POST(request(body))).status).toBe(400)
  for (const body of [{token:'bad'},{token:id,extra:1},null]) expect((await join(request(body))).status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
})
test('join returns only group id and hides invalid or rotated invite details', async () => {
  rpc.mockResolvedValueOnce({data:id,error:null})
  expect(await (await join(request({token:id}))).json()).toEqual({groupId:id})
  rpc.mockResolvedValueOnce({data:null,error:{code:'P0002',message:'secret'}})
  const response=await join(request({token:id})); expect(response.status).toBe(404); expect(JSON.stringify(await response.json())).not.toContain('secret')
})
test('details forward member-only RPC result', async () => {
  const data={group:{id,name:'Friends',ownerId:id},members:[{userId:id,displayName:'Me'}],inviteToken:id,viewerId:id}
  rpc.mockResolvedValueOnce({data,error:null})
  expect(await (await details(request({}),ctx)).json()).toEqual(data)
  expect(rpc).toHaveBeenCalledWith('get_group_details',{group_id:id})
})
test('all actions call narrow RPCs and reject extra or invalid fields', async () => {
  for (const [name,rpcName] of [['leave','leave_group'],['close','close_group'],['rotate-invite','rotate_group_invite'],['remove','remove_group_member']]) {
    rpc.mockResolvedValueOnce({data:name==='rotate-invite'?id:null,error:null})
    const response=await action(request({action:name,...(name==='remove'?{memberId:id}:{})}),ctx)
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ok:true,...(name==='rotate-invite'?{inviteToken:id}:{})})
    expect(rpc).toHaveBeenLastCalledWith(rpcName,{group_id:id,...(name==='remove'?{member_id:id}:{})})
  }
  for (const body of [{action:'unknown'},{action:'remove'},{action:'leave',memberId:id},{action:'close',extra:1}]) expect((await action(request(body),ctx)).status).toBe(400)
})
test('authorization and validation errors are safe on direct database refusal', async () => {
  for (const [code,status] of [['P0002',404],['42501',404],['22023',400],['XX000',500]]) {
    rpc.mockResolvedValueOnce({data:null,error:{code,message:'sensitive database information'}})
    const response=await action(request({action:'close'}),ctx)
    expect(response.status).toBe(status); expect(JSON.stringify(await response.json())).not.toContain('sensitive')
  }
})
test('metrics allow only real Monday dates and return exactly aggregate fields', async () => {
  for (const week of ['2026-02-30','2026-10-20','bad','']) expect((await metrics(new Request(`http://localhost?weekStart=${week}`),ctx)).status).toBe(400)
  rpc.mockResolvedValueOnce({data:[{display_name:'Me',total_r:1,win_rate:0.5,completed_count:2,original_note:'secret'}],error:null})
  const response=await metrics(new Request('http://localhost?weekStart=2026-10-19'),ctx)
  expect(await response.json()).toEqual({weekStart:'2026-10-19',metrics:[{displayName:'Me',totalR:1,winRate:0.5,completedCount:2}]})
  expect(rpc).toHaveBeenLastCalledWith('group_weekly_metrics',{group_id:id,week_start:'2026-10-19'})
})
test('malformed JSON and identifiers are rejected and thrown database failures are safe', async () => {
  expect((await POST(new Request('http://localhost',{method:'POST',body:'{'}))).status).toBe(400)
  expect((await details(request({}),{params:Promise.resolve({groupId:'bad'})})).status).toBe(400)
  rpc.mockRejectedValueOnce(new Error('secret'))
  expect((await GET()).status).toBe(500)
})
