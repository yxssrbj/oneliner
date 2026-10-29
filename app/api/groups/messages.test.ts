import { beforeEach, expect, test, vi } from 'vitest'
import { GET, POST } from './[groupId]/messages/route'
import { GET as image } from './[groupId]/messages/[messageId]/image/route'

const { getAuthenticatedUser, rpc } = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn(), rpc: vi.fn() }))
vi.mock('../../../lib/supabase/server', () => ({ getAuthenticatedUser }))
const id = '60000000-0000-0000-0000-000000000001'
const messageId = '60000000-0000-0000-0000-000000000002'
const context = { params: Promise.resolve({ groupId: id }) }
const imageContext = { params: Promise.resolve({ groupId: id, messageId }) }
function post(body: string, file?: File) {
  const data = new FormData()
  data.set('text', body)
  if (file) data.set('image', file)
  return new Request('http://localhost/api/groups/'+id+'/messages', { method: 'POST', body: data })
}
beforeEach(() => { vi.clearAllMocks(); getAuthenticatedUser.mockResolvedValue({ user: { id }, supabase: { rpc } }); rpc.mockResolvedValue({ data: [], error: null }) })

test('all message routes require identity and prevent caching', async () => {
  getAuthenticatedUser.mockResolvedValue(null)
  for (const response of await Promise.all([GET(new Request('http://localhost/api/groups/'+id+'/messages'),context), POST(post('hello'),context), image(new Request('http://localhost'),imageContext)])) {
    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
  }
})
test('lists messages with a validated cursor', async () => {
  const url = `http://localhost/api/groups/${id}/messages?before=2026-10-28T12%3A00%3A00Z&beforeId=${messageId}`
  const response = await GET(new Request(url),context)
  expect(response.status).toBe(200)
  expect(rpc).toHaveBeenCalledWith('list_group_messages',{group_id:id,before_time:'2026-10-28T12:00:00.000Z',before_id:messageId})
  expect((await GET(new Request(`http://localhost/api/groups/${id}/messages?before=bad`),context)).status).toBe(400)
})
test('sends text and picture through one RPC transaction', async () => {
  rpc.mockResolvedValueOnce({ data: { id: messageId }, error: null })
  const png = new File([Uint8Array.from([137,80,78,71,13,10,26,10,0])], 'chart.png', { type: 'image/png' })
  const response = await POST(post('  chart here  ',png),context)
  expect(response.status).toBe(201)
  expect(rpc).toHaveBeenCalledWith('send_group_message',{group_id:id,message_text:'chart here',image_type:'image/png',image_bytes:expect.stringMatching(/^\\x89504e47/)})
})
test('rejects invalid content before the RPC', async () => {
  const fake = new File(['not image'], 'fake.png', { type: 'image/png' })
  const large = new File([new Uint8Array(1048577)], 'large.png', { type: 'image/png' })
  for (const request of [post(''),post('x'.repeat(2001)),post('',fake),post('',large)]) expect((await POST(request,context)).status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
})
test('stops an oversized multipart request before parsing it', async () => {
  const request = new Request('http://localhost/api/groups/'+id+'/messages', {
    method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=limit'},body:'x'.repeat(1100001),
  })
  expect((await POST(request,context)).status).toBe(413)
  expect(rpc).not.toHaveBeenCalled()
})
test('only image RPC bytes become a private image response', async () => {
  rpc.mockResolvedValueOnce({ data: [{ content_type:'image/png', data_base64: Buffer.from('picture').toString('base64') }], error: null })
  const response = await image(new Request('http://localhost'),imageContext)
  expect(response.status).toBe(200)
  expect(response.headers.get('Content-Type')).toBe('image/png')
  expect(response.headers.get('Cache-Control')).toContain('no-store')
  expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('picture')
  expect(rpc).toHaveBeenCalledWith('read_group_image',{group_id:id,message_id:messageId})
})
test('database refusal hides member-only data and image bytes', async () => {
  rpc.mockResolvedValue({ data:null,error:{code:'P0002',message:'secret'} })
  for (const response of [await GET(new Request('http://localhost'),context),await POST(post('hello'),context),await image(new Request('http://localhost'),imageContext)]) {
    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain('secret')
  }
})
