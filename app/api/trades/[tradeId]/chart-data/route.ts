import { getAuthenticatedUser } from '../../../../../lib/supabase/server'
import { validateChartBars } from '../../../../../lib/trades/chart-csv'

const headers = { 'Cache-Control': 'private, no-store' }
const maximumBodyBytes = 2_000_000
const failure = (error: string, status: number) => Response.json({ error }, { status, headers })
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

export async function GET(_request: Request, { params }: { params: Promise<{ tradeId: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return failure('Sign in required.', 401)
  const { tradeId } = await params
  if (!validId(tradeId)) return failure('Invalid trade ID.', 400)
  try {
    const { data, error } = await auth.supabase.from('trades').select('chart_data').eq('owner_id', auth.user.id).eq('id', tradeId).maybeSingle()
    if (error) return failure('Could not load chart data.', 500)
    if (!data) return failure('Trade not found.', 404)
    const chartData = data.chart_data === null ? null : validateChartBars(data.chart_data)
    if (data.chart_data !== null && !chartData) return failure('Stored chart data is invalid.', 500)
    return Response.json({ chartData }, { headers })
  } catch { return failure('Could not load chart data.', 500) }
}

export async function PUT(request: Request, { params }: { params: Promise<{ tradeId: string }> }) {
  const auth = await getAuthenticatedUser()
  if (!auth) return failure('Sign in required.', 401)
  const { tradeId } = await params
  if (!validId(tradeId)) return failure('Invalid trade ID.', 400)
  if (Number(request.headers.get('content-length')) > maximumBodyBytes) return failure('Chart data must be smaller than 2 MB.', 413)
  let input
  try {
    const reader = request.body?.getReader()
    let body = ''
    let bytes = 0
    const decoder = new TextDecoder()
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > maximumBodyBytes) {
        await reader.cancel().catch(() => undefined)
        return failure('Chart data must be smaller than 2 MB.', 413)
      }
      body += decoder.decode(value, { stream: true })
    }
    body += decoder.decode()
    input = JSON.parse(body)
  } catch { return failure('Invalid request.', 400) }
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || !('chartData' in input)) return failure('Chart data is invalid.', 400)
  const chartData = validateChartBars(input.chartData)
  if (!chartData) return failure('Chart data is invalid. Upload a CSV with valid chronological OHLC values.', 400)
  try {
    const { data, error } = await auth.supabase.from('trades').update({ chart_data: chartData }).eq('owner_id', auth.user.id).eq('id', tradeId).select('chart_data').maybeSingle()
    if (error) return failure('Could not save chart data. Your import is kept; retry saving.', 500)
    if (!data) return failure('Trade not found.', 404)
    return Response.json({ chartData: data.chart_data }, { headers })
  } catch { return failure('Could not save chart data. Your import is kept; retry saving.', 500) }
}
