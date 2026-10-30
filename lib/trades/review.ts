import { nextWeekStartUtc } from './week'

export type ReviewTrade = { id: string; opened_at: string; setup: string | null; exit_price: string | null; r_result: string | null; source_net_pnl_usd?: string | null }

const result = (trade: ReviewTrade) => Number(trade.r_result)
const outcome = (trade: ReviewTrade) => Number(trade.source_net_pnl_usd ?? trade.r_result)

function summarize(rows: ReviewTrade[]) {
  const closed = rows.filter(trade => trade.exit_price !== null)
  const measured = closed.filter(trade => trade.r_result !== null)
  const total = measured.reduce((sum, trade) => sum + result(trade), 0)
  const wins = closed.filter(trade => outcome(trade) > 0).length
  const losses = closed.filter(trade => outcome(trade) < 0).length
  return {
    totalR: measured.length ? total : null,
    averageR: measured.length ? total / measured.length : null,
    bestR: measured.length ? Math.max(...measured.map(result)) : null,
    winRate: closed.length ? wins / closed.length : null,
    wins,
    losses,
    breakeven: closed.length - wins - losses,
    completedCount: closed.length,
    unfinishedCount: rows.length - closed.length,
    missingRCount: closed.length - measured.length,
  }
}

export function buildWeeklyReview<T extends ReviewTrade>(trades: T[], week: string) {
  const end = `${nextWeekStartUtc(week)}T00:00:00Z`
  const start = `${week}T00:00:00Z`
  const selected = trades.filter(trade => Date.parse(trade.opened_at) >= Date.parse(start) && Date.parse(trade.opened_at) < Date.parse(end))
  const metrics = summarize(selected)
  const ordered = selected.filter(trade => trade.exit_price !== null && trade.r_result !== null)
    .sort((a, b) => Date.parse(a.opened_at) - Date.parse(b.opened_at) || a.id.localeCompare(b.id))
  let cumulative = 0
  const points = ordered.length ? [{ tradeId: null as string | null, openedAt: start, resultR: 0, totalR: 0 }, ...ordered.map(trade => ({ tradeId: trade.id, openedAt: trade.opened_at, resultR: result(trade), totalR: cumulative += result(trade) }))] : []
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(date.getUTCDate() + index)
    const day = date.toISOString().slice(0, 10)
    const rows = selected.filter(trade => new Date(trade.opened_at).toISOString().slice(0, 10) === day)
    return { date: day, ...summarize(rows) }
  })
  const bySetup = new Map<string, ReviewTrade[]>()
  for (const trade of selected) {
    const name = trade.setup || 'Unclassified'
    bySetup.set(name, [...(bySetup.get(name) ?? []), trade])
  }
  const setups = [...bySetup].map(([name, rows]) => ({ name, ...summarize(rows) }))
    .sort((a, b) => (b.totalR ?? -Infinity) - (a.totalR ?? -Infinity) || a.name.localeCompare(b.name))
  return { trades: selected, metrics, points, days, setups }
}
