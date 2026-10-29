import AppShell from '../components/app-shell'
import GroupMetrics from '../components/group-metrics'
import { isUuid } from '../../lib/groups/validation'
import { io } from 'next/cache'
export const instant = false
export default async function Friends({searchParams}:{searchParams:Promise<{group?:string|string[]}>}) {
  await io()
  const {group}=await searchParams
  return <AppShell title="Friends"><GroupMetrics initialGroup={isUuid(group)?group:undefined}/></AppShell>
}
