export function summarizeTrades(trades: { r_result: number | null; exit_price: string | null; source_net_pnl_usd?: string | null }[]) {
  let totalR = 0, wins = 0, completedCount = 0, missingRCount = 0
  for (const trade of trades) {
    if (trade.exit_price === null) continue
    completedCount++
    if (Number(trade.source_net_pnl_usd ?? trade.r_result) > 0) wins++
    if (trade.r_result === null) missingRCount++
    else totalR += trade.r_result
  }
  return { totalR: completedCount > missingRCount ? totalR : null, wins, completedCount, unfinishedCount: trades.length - completedCount, winRate: completedCount ? wins / completedCount : null, missingRCount }
}
