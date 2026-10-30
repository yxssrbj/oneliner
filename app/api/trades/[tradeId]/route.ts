import { getAuthenticatedUser } from '../../../../lib/supabase/server'
import { isPrice, validateDraft } from '../../../../lib/trades/validation'

const headers = { 'Cache-Control': 'private, no-store' }
const failure = (error: string, status: number) => Response.json({ error }, { status, headers })

export async function PATCH(request: Request, { params }: { params: Promise<{ tradeId: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return failure('Sign in required.', 401)
  const { tradeId } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tradeId)) return failure('Invalid trade ID.', 400)
  let input
  try { input = await request.json() } catch { return failure('Invalid request.', 400) }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return failure('Check the trade fields.', 400)
  let changes
  if (Object.keys(input).length === 1 && 'exitPrice' in input) {
    if (!isPrice(input.exitPrice)) return failure('Exit must be a positive decimal price.', 400)
    changes = { exit_price: input.exitPrice }
  } else {
    const fields = ['symbol', 'side', 'entryPrice', 'stopPrice', 'setup', 'openedAt', 'confirmed']
    if (Object.keys(input).some(key => !fields.includes(key)) || input.confirmed !== true) return failure('Review and confirm the corrected fields.', 400)
    // The original note is immutable; only confirmed trade details are corrected.
    const result = validateDraft({ ...input, originalNote: 'original note preserved' })
    if (result.error) return failure(result.error, 400)
    const draft = result.value!
    changes = { symbol: draft.symbol, side: draft.side, entry_price: draft.entryPrice, stop_price: draft.stopPrice, setup: draft.setup, opened_at: draft.openedAt }
  }
  try {
    const { data, error } = await auth.supabase.from('trades').update(changes).eq('owner_id', auth.user.id).eq('id', tradeId).select('id,original_note,symbol,side,entry_price::text,stop_price::text,setup,opened_at,exit_price::text,r_result::text,source_net_pnl_usd::text,created_at,updated_at').maybeSingle()
    if (error) return failure('Could not save the correction. Your changes are kept; retry saving.', 500)
    if (!data) return failure('Trade not found.', 404)
    return Response.json({ trade: data }, { headers })
  } catch { return failure('Could not save the correction. Your changes are kept; retry saving.', 500) }
}
