import { authenticated, body, failure, invalid, json, keys } from './shared'
export async function GET() {
  return authenticated(async ({supabase}) => {
    const {data,error} = await supabase.rpc('list_my_groups')
    return error ? failure(error) : json({groups:data})
  })
}
export async function POST(request: Request) {
  return authenticated(async ({supabase}) => {
    const value = await body(request)
    if (!keys(value,['name']) || typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length>80) return invalid()
    const {data,error} = await supabase.rpc('create_group',{name:value.name.trim()})
    return error ? failure(error) : json({groupId:data},201)
  })
}
