import AppShell from '../components/app-shell'
import GroupMetrics from '../components/group-metrics'
import { isUuid } from '../../lib/groups/validation'
export const instant = false
export default async function Friends({searchParams}:{searchParams:Promise<{group?:string|string[]}>}) {
  const {group}=await searchParams
  return <AppShell title="Friends"><GroupMetrics initialGroup={isUuid(group)?group:undefined}/></AppShell>
}
