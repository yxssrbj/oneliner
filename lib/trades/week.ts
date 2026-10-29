export function weekStartUtc(date: Date): string {
  const start = new Date(date)
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7)
  return start.toISOString().slice(0, 10)
}

export function nextWeekStartUtc(weekStart: string): string {
  return new Date(Date.parse(`${weekStart}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10)
}
