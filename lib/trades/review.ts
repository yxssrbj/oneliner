import { nextWeekStartUtc } from './week'

export type ReviewTrade = { id: string; opened_at: string; setup: string; exit_price: string | null; r_result: string | null }

export function buildWeeklyReview<T extends ReviewTrade>(trades: T[], week: string) {
  const end = `${nextWeekStartUtc(week)}T00:00:00Z`
  const start = `${week}T00:00:00Z`
  const selected = trades.filter(trade => Date.parse(trade.opened_at) >= Date.parse(start) && Date.parse(trade.opened_at) < Date.parse(end))
  const completed = selected.filter(trade => trade.exit_price !== null && trade.r_result !== null)
  const result = (trade: ReviewTrade) => Number(trade.r_result)
  const total = completed.reduce((sum, trade) => sum + result(trade), 0)
  const wins = completed.filter(trade => result(trade) > 0).length
  const metrics = {
    totalR: completed.length ? total : null,
    averageR: completed.length ? total / completed.length : null,
    bestR: completed.length ? Math.max(...completed.map(result)) : null,
    winRate: completed.length ? wins / completed.length : null,
    wins,
    completedCount: completed.length,
    unfinishedCount: selected.length - completed.length,
  }
  const ordered = [...completed].sort((a, b) => Date.parse(a.opened_at) - Date.parse(b.opened_at) || a.id.localeCompare(b.id))
  let cumulative = 0
  const points = completed.length ? [{ tradeId: null as string | null, openedAt: start, resultR: 0, totalR: 0 }, ...ordered.map(trade => ({ tradeId: trade.id, openedAt: trade.opened_at, resultR: result(trade), totalR: cumulative += result(trade) }))] : []
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(date.getUTCDate() + index)
    const day = date.toISOString().slice(0, 10)
    const rows = selected.filter(trade => trade.opened_at.slice(0, 10) === day)
    const done = rows.filter(trade => trade.exit_price !== null && trade.r_result !== null)
    return { date: day, totalR: done.reduce((sum, trade) => sum + result(trade), 0), completedCount: done.length, unfinishedCount: rows.length - done.length }
  })
  const bySetup = new Map<string, ReviewTrade[]>()
  for (const trade of selected) bySetup.set(trade.setup, [...(bySetup.get(trade.setup) ?? []), trade])
  const setups = [...bySetup].map(([name, rows]) => {
    const done = rows.filter(trade => trade.exit_price !== null && trade.r_result !== null)
    return { name, totalR: done.reduce((sum, trade) => sum + result(trade), 0), completedCount: done.length, unfinishedCount: rows.length - done.length, wins: done.filter(trade => result(trade) > 0).length }
  }).sort((a, b) => b.totalR - a.totalR || a.name.localeCompare(b.name))
  return { trades: selected, metrics, points, days, setups }
}
