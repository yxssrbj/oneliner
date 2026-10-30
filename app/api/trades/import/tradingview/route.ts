import { getAuthenticatedUser } from '../../../../../lib/supabase/server'
import { parseTradingViewTradeHistoryCsv } from '../../../../../lib/trades/tradingview-history'

const headers = { 'Cache-Control': 'private, no-store' }
const failure = (error: string, status: number) => Response.json({ error }, { status, headers })

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser()
  if (!auth) return failure('Sign in required.', 401)
  let input
  try {
    const reader = request.body?.getReader()
    if (!reader) return failure('Invalid request.', 400)
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      // A 2 MB CSV may expand sixfold when JSON escapes its characters.
      if (size > 12_001_024) { await reader.cancel(); return failure('Import request is too large.', 400) }
      chunks.push(value)
    }
    input = JSON.parse(await new Blob(chunks as BlobPart[]).text())
  } catch { return failure('Invalid request.', 400) }
  if (!input || typeof input.csv !== 'string' || typeof input.timeZone !== 'string' || input.timeZone.length > 100 || typeof input.commit !== 'boolean') return failure('Supply a CSV, timezone and preview or save choice.', 400)
  if (input.commit && input.previewOwner !== auth.user.id) return failure('Account changed. Preview the CSV again before saving.', 409)
  let trades
  try { trades = parseTradingViewTradeHistoryCsv(input.csv, input.timeZone) }
  catch (cause) { return failure(cause instanceof Error ? cause.message : 'Could not read the CSV.', 400) }
  if (!input.commit) return Response.json({ trades }, { headers })
  let committed = false
  const detailsFailure = 'Trades were saved, but their details could not be loaded. Retry to load them without duplicates.'
  try {
    const { data, error } = await auth.supabase.rpc('import_trade_history', { rows: trades })
    if (error?.code === '23505') return failure('An imported trade has different source details. Check the CSV and timezone before retrying.', 409)
    if (error || !Number.isInteger(data?.inserted) || !Number.isInteger(data?.alreadyPresent) || data.inserted < 0 || data.alreadyPresent < 0 || data.inserted + data.alreadyPresent !== trades.length) return failure('Could not confirm the import was saved. Your CSV is kept; retry saving.', 500)
    committed = true
    const keys = new Set(trades.map(trade => trade.sourceKey))
    const query = auth.supabase.from('trades').select('id,original_note,symbol,side,entry_price::text,stop_price::text,setup,opened_at,exit_price::text,r_result::text,source_net_pnl_usd::text,source_key').eq('owner_id', auth.user.id).order('id', { ascending: true })
    // Paginate owner rows because large source-key lists can exceed PostgREST URL limits.
    const saved = []
    for (let offset = 0; ; offset += 1000) {
      const page = await query.range(offset, offset + 999)
      if (page.error) return failure(detailsFailure, 500)
      saved.push(...(page.data ?? []).filter(trade => keys.has(trade.source_key)))
      if (saved.length === keys.size || (page.data?.length ?? 0) < 1000) break
    }
    if (saved.length !== keys.size) return failure(detailsFailure, 500)
    return Response.json({ inserted: data.inserted, alreadyPresent: data.alreadyPresent, trades: saved }, { headers })
  } catch { return failure(committed ? detailsFailure : 'Could not confirm the import was saved. Your CSV is kept; retry saving.', 500) }
}
