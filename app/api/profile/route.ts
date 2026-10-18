import { getAuthenticatedUser } from '../../../lib/supabase/server'

const noStore = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  const auth = await getAuthenticatedUser()
  if (!auth) return Response.json({ error: 'Sign in required.' }, { status: 401, headers: noStore })
  const { data, error } = await auth.supabase.from('profiles').select('display_name').eq('id', auth.user.id).single()
  if (error && error.code !== 'PGRST116') return Response.json({ error: 'Could not load profile.' }, { status: 500, headers: noStore })
  return Response.json({ displayName: data?.display_name ?? null }, { headers: noStore })
}

export async function PUT(request: Request) {
  const auth = await getAuthenticatedUser()
  if (!auth) return Response.json({ error: 'Sign in required.' }, { status: 401, headers: noStore })
  let body: unknown
  try { body = await request.json() } catch { return Response.json({ error: 'Invalid request.' }, { status: 400, headers: noStore }) }
  const name = typeof body === 'object' && body !== null && 'displayName' in body && typeof body.displayName === 'string' ? body.displayName.trim() : ''
  if (!name || name.length > 80) return Response.json({ error: 'Display name must be 1–80 characters.' }, { status: 400, headers: noStore })
  const { data, error } = await auth.supabase.from('profiles').upsert({ id: auth.user.id, display_name: name }, { onConflict: 'id' }).select('display_name').single()
  if (error) return Response.json({ error: 'Could not save profile.' }, { status: 500, headers: noStore })
  return Response.json({ displayName: data.display_name }, { headers: noStore })
}
