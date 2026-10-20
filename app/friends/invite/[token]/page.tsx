import Link from 'next/link'
import GroupForm, { sharingDisclosure } from '../../../components/group-form'
import { getAuthenticatedUser } from '../../../../lib/supabase/server'
import { isUuid } from '../../../../lib/groups/validation'
export const instant = false
export default async function Invite({params}:{params:Promise<{token:string}>}) {
  const {token}=await params
  const auth=await getAuthenticatedUser()
  return <main className="invite-page"><Link className="brand" href="/">◼ Oneliner</Link><h1>Join a private group</h1>
    {!isUuid(token)?<p role="alert">Group or invite unavailable. Ask the owner for a new link.</p>:auth?<GroupForm inviteToken={token}/>:<><p>{sharingDisclosure}</p><Link className="invite-sign-in" href={`/sign-in?invite=${token}`}>Sign in to join</Link></>}
  </main>
}
