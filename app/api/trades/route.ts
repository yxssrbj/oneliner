import { getAuthenticatedUser } from '../../../lib/supabase/server'
import { comparePrices, isPrice, validateDraft } from '../../../lib/trades/validation'

const columns = 'id,original_note,symbol,side,entry_price::text,stop_price::text,setup,opened_at,exit_price::text,r_result::text,created_at,updated_at'
const headers = { 'Cache-Control': 'private, no-store' }
const failure = (error: string, status: number) => Response.json({ error }, { status, headers })
export async function POST(request: Request) {
  const auth = await getAuthenticatedUser()
  if (!auth) return failure('Sign in required.', 401)
  const key = request.headers.get('Idempotency-Key') ?? ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return failure('A valid save key is required.', 400)
  let input
  try { input = await request.json() } catch { return failure('Invalid request.', 400) }
  const validated = validateDraft(input)
  if (validated.error) return failure(validated.error, 400)
  const draft = validated.value!
  const row = { owner_id: auth.user.id, original_note: draft.originalNote, symbol: draft.symbol, side: draft.side, entry_price: draft.entryPrice, stop_price: draft.stopPrice, setup: draft.setup, opened_at: draft.openedAt, idempotency_key: key }
  try {
    const { data, error } = await auth.supabase.from('trades').insert(row).select(columns).single()
    if (!error && data?.id) return Response.json({ trade: data }, { status: 201, headers })
    if (error?.code === '23505') {
      const existing = await auth.supabase.from('trades').select(columns).eq('owner_id', auth.user.id).eq('idempotency_key', key).single()
      if (!existing.error && existing.data?.id) {
        const saved = existing.data
        const same = saved.original_note === row.original_note && saved.symbol === row.symbol && saved.side === row.side && saved.setup === row.setup && Date.parse(saved.opened_at) === Date.parse(row.opened_at) && isPrice(saved.entry_price) && isPrice(saved.stop_price) && comparePrices(saved.entry_price, row.entry_price) === 0 && comparePrices(saved.stop_price, row.stop_price) === 0
        if (!same) return failure('This trade was already saved with different details. Your corrections are kept; check the saved trade before retrying.', 409)
        return Response.json({ trade: saved }, { headers })
      }
    }
    return failure('Could not confirm the trade was saved. Your draft is kept; retry saving.', 500)
  } catch { return failure('Could not confirm the trade was saved. Your draft is kept; retry saving.', 500) }
}
export async function GET(request: Request) {
  const auth = await getAuthenticatedUser()
  if (!auth) return failure('Sign in required.', 401)
  const params = new URL(request.url).searchParams
  const week = params.get('week')
  let start: Date | undefined
  if (week) {
    start = new Date(`${week}T00:00:00.000Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || !Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== week || start.getUTCDay() !== 1) return failure('Week must be a Monday date (YYYY-MM-DD), in UTC.', 400)
  }
  try {
    let query = auth.supabase.from('trades').select(columns).eq('owner_id', auth.user.id)
    if (params.get('inbox') === 'true') query = query.is('exit_price', null)
    if (start) query = query.gte('opened_at', start.toISOString()).lt('opened_at', new Date(start.getTime() + 7 * 86400000).toISOString())
    const { data, error } = await query.order('opened_at', { ascending: false })
    if (error) return failure('Could not load trades.', 500)
    return Response.json({ trades: data }, { headers })
  } catch { return failure('Could not load trades.', 500) }
}
