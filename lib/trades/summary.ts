export function summarizeTrades(trades: { r_result: number | null }[]) {
  let totalR = 0, wins = 0, completedCount = 0
  for (const trade of trades) {
    if (trade.r_result === null) continue
    totalR += trade.r_result
    completedCount++
    if (trade.r_result > 0) wins++
  }
  return { totalR, wins, completedCount, unfinishedCount: trades.length - completedCount, winRate: completedCount ? wins / completedCount : null }
}
