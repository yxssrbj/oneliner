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
  let trades
  try { trades = parseTradingViewTradeHistoryCsv(input.csv, input.timeZone) }
  catch (cause) { return failure(cause instanceof Error ? cause.message : 'Could not read the CSV.', 400) }
  if (!input.commit) return Response.json({ trades }, { headers })
  try {
    const { data, error } = await auth.supabase.rpc('import_trade_history', { rows: trades })
    if (error?.code === '23505') return failure('An imported trade has different source details. Check the CSV and timezone before retrying.', 409)
    if (error || !Number.isInteger(data?.inserted) || !Number.isInteger(data?.alreadyPresent) || data.inserted < 0 || data.alreadyPresent < 0 || data.inserted + data.alreadyPresent !== trades.length) return failure('Could not confirm the import was saved. Your CSV is kept; retry saving.', 500)
    return Response.json({ inserted: data.inserted, alreadyPresent: data.alreadyPresent }, { headers })
  } catch { return failure('Could not confirm the import was saved. Your CSV is kept; retry saving.', 500) }
}
