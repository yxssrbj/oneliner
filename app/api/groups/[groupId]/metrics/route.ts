import { isMonday, isUuid } from '../../../../../lib/groups/validation'
import { authenticated, failure, invalid, json } from '../../shared'
export async function GET(request: Request, context: {params:Promise<{groupId:string}>}) {
  return authenticated(async ({supabase}) => {
    const {groupId} = await context.params
    const weekStart = new URL(request.url).searchParams.get('weekStart')
    if (!isUuid(groupId) || !isMonday(weekStart)) return invalid()
    const {data,error} = await supabase.rpc('group_weekly_metrics',{group_id:groupId,week_start:weekStart})
    return error ? failure(error) : json({weekStart,metrics:(data ?? []).map((row: {display_name:string,total_r:number,win_rate:number|null,completed_count:number}) => ({displayName:row.display_name,totalR:row.total_r,winRate:row.win_rate,completedCount:row.completed_count}))})
  })
}
