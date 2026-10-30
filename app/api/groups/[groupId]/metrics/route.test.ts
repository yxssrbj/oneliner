import { beforeEach, expect, test, vi } from 'vitest'
import { GET } from './route'
const { getAuthenticatedUser, rpc } = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn(), rpc: vi.fn() }))
vi.mock('../../../../../lib/supabase/server', () => ({ getAuthenticatedUser }))
const id = '50000000-0000-0000-0000-000000000001'
beforeEach(() => { vi.clearAllMocks(); getAuthenticatedUser.mockResolvedValue({user:{id},supabase:{rpc}}) })
test('preserves unavailable R and strips personal source data', async () => {
  rpc.mockResolvedValue({data:[{display_name:'Member',total_r:null,win_rate:0.5,completed_count:6,source_net_pnl_usd:100,original_note:'private',id:'private'}],error:null})
  const response = await GET(new Request('http://localhost?weekStart=2026-10-19'), {params:Promise.resolve({groupId:id})})
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await response.json()).toEqual({weekStart:'2026-10-19',metrics:[{displayName:'Member',totalR:null,winRate:0.5,completedCount:6}]})
})
