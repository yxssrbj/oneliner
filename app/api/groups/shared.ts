import { getAuthenticatedUser } from '../../../lib/supabase/server'
export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
export const invalid = () => json({ error: 'Invalid request.' }, 400)
export async function body(request: Request): Promise<Record<string, unknown> | null> {
  try { const value = await request.json(); return value && typeof value === 'object' && !Array.isArray(value) ? value : null } catch { return null }
}
export function keys(value: Record<string, unknown> | null, expected: string[]): value is Record<string, unknown> {
  return !!value && Object.keys(value).length === expected.length && expected.every(key => key in value)
}
export async function authenticated(action: (auth: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>) => Promise<Response>) {
  try {
    const auth = await getAuthenticatedUser()
    return auth ? await action(auth) : json({ error: 'Sign in required.' }, 401)
  } catch { return json({ error: 'Could not complete the request. Try again.' }, 500) }
}
export function failure(error: {code?: string}) {
  const status = error.code === 'P0002' || error.code === '42501' ? 404 : error.code === '22023' || error.code === '22P02' ? 400 : 500
  return json({ error: status === 404 ? 'Group or invite unavailable.' : status === 400 ? 'Check your input and display name.' : 'Could not complete the request. Try again.' },status)
}
