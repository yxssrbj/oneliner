import { nextWeekStartUtc } from '../../../lib/trades/week'
import { summarizeTrades } from '../../../lib/trades/summary'
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
  const row = { owner_id: auth.user.id, original_note: draft.originalNote, symbol: draft.symbol, side: draft.side, entry_price: draft.entryPrice, stop_price: draft.stopPrice, setup: draft.setup, opened_at: draft.openedAt, idempotency_key: key, ...(draft.exitPrice ? { exit_price: draft.exitPrice } : {}) }
  try {
    const { data, error } = await auth.supabase.from('trades').insert(row).select(columns).single()
    if (!error && data?.id) return Response.json({ trade: data }, { status: 201, headers })
    if (error?.code === '23505') {
      const existing = await auth.supabase.from('trades').select(columns).eq('owner_id', auth.user.id).eq('idempotency_key', key).single()
      if (!existing.error && existing.data?.id) {
        const saved = existing.data
        const sameExit = draft.exitPrice ? isPrice(saved.exit_price) && comparePrices(saved.exit_price, draft.exitPrice) === 0 : saved.exit_price == null
        const same = sameExit && saved.original_note === row.original_note && saved.symbol === row.symbol && saved.side === row.side && saved.setup === row.setup && Date.parse(saved.opened_at) === Date.parse(row.opened_at) && isPrice(saved.entry_price) && isPrice(saved.stop_price) && comparePrices(saved.entry_price, row.entry_price) === 0 && comparePrices(saved.stop_price, row.stop_price) === 0
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
  if (['week', 'weekStart', 'status', 'inbox', 'recent'].some(key => params.getAll(key).length > 1)) return failure('Supply each filter once.', 400)
  if (params.has('recent') && params.get('recent') !== '3') return failure('Recent must be 3.', 400)
  if (params.has('recent') && ['week', 'weekStart', 'status', 'inbox'].some(key => params.has(key))) return failure('Recent cannot be combined with other trade filters.', 400)
  if (params.has('week') && params.has('weekStart') && params.get('week') !== params.get('weekStart')) return failure('Conflicting week filters.', 400)
  if (params.has('status') && params.get('status') !== 'open') return failure('Status must be open.', 400)
  if (params.has('inbox') && !['true', 'false'].includes(params.get('inbox')!)) return failure('Inbox must be true or false.', 400)
  if (params.has('status') && params.get('inbox') === 'false') return failure('Conflicting status filters.', 400)
  const week = params.get('weekStart') ?? params.get('week')
  let start: Date | undefined
  if (week !== null) {
    start = new Date(`${week}T00:00:00.000Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || !Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== week || start.getUTCDay() !== 1) return failure('Week must be a Monday date (YYYY-MM-DD), in UTC.', 400)
  }
  try {
    let query = auth.supabase.from('trades').select(columns).eq('owner_id', auth.user.id)
    if (params.get('status') === 'open' || params.get('inbox') === 'true') query = query.is('exit_price', null)
    if (start) query = query.gte('opened_at', start.toISOString()).lt('opened_at', `${nextWeekStartUtc(week!)}T00:00:00.000Z`)
    query = query.order(params.has('recent') ? 'created_at' : 'opened_at', { ascending: false }).order('id', { ascending: false })
    const first = await query.range(0, params.has('recent') ? 2 : 999)
    if (first.error) return failure('Could not load trades.', 500)
    const data = first.data ?? []
    let pageSize = data.length
    while (!params.has('recent') && pageSize === 1000) {
      const page = await query.range(data.length, data.length + 999)
      if (page.error) return failure('Could not load trades.', 500)
      pageSize = page.data?.length ?? 0
      data.push(...(page.data ?? []))
    }
    return Response.json({ trades: data, ...(start ? { summary: summarizeTrades((data ?? []).map(trade => ({ r_result: trade.r_result === null ? null : Number(trade.r_result) }))) } : {}) }, { headers })
  } catch { return failure('Could not load trades.', 500) }
}
