import { isUuid } from '../../../../lib/groups/validation'
import { authenticated, body, failure, invalid, json, keys } from '../shared'
export async function POST(request: Request) {
  return authenticated(async ({supabase}) => {
    const value = await body(request)
    if (!keys(value,['token']) || !isUuid(value.token)) return invalid()
    const {data,error} = await supabase.rpc('join_group',{token:value.token})
    return error ? failure(error) : json({groupId:data})
  })
}
