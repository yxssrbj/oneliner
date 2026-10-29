import { isUuid } from '../../../../lib/groups/validation'
import { authenticated, body, failure, invalid, json, keys } from '../shared'
type Context = {params:Promise<{groupId:string}>}
export async function GET(_request: Request, context: Context) {
  return authenticated(async ({supabase}) => {
    const {groupId} = await context.params
    if (!isUuid(groupId)) return invalid()
    const {data,error} = await supabase.rpc('get_group_details',{group_id:groupId})
    return error ? failure(error) : json(data)
  })
}
export async function POST(request: Request, context: Context) {
  return authenticated(async ({supabase}) => {
    const {groupId} = await context.params
    const value = await body(request)
    if (!isUuid(groupId) || !value || !keys(value,value.action === 'remove' ? ['action','memberId'] : value.action === 'rename' ? ['action','name'] : ['action'])) return invalid()
    const actions = {leave:'leave_group',remove:'remove_group_member','rotate-invite':'rotate_group_invite',close:'close_group',rename:'rename_group'} as const
    if (typeof value.action !== 'string' || !Object.hasOwn(actions,value.action) || (value.action==='remove' && !isUuid(value.memberId)) || (value.action==='rename' && (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 80))) return invalid()
    const action = value.action as keyof typeof actions
    const {data,error} = await supabase.rpc(actions[action],{group_id:groupId,...(action==='remove'?{member_id:value.memberId}:action==='rename'?{new_name:(value.name as string).trim()}:{})})
    return error ? failure(error) : json({ok:true,...(action==='rotate-invite'?{inviteToken:data}:{})})
  })
}
