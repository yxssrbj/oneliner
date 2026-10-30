export type ImportedTrade = {
  sourceKey: string
  symbol: string
  side: 'long' | 'short'
  entryPrice: string
  exitPrice: string
  openedAt: string
  sourcePnlUsd: string
  quantity: string
}

type CsvRow = { values: string[]; line: number }

function csvRows(csv: string): CsvRow[] {
  const rows: CsvRow[] = []
  let values: string[] = [], cell = '', quoted = false, closed = false, line = 1, start = 1
  const finish = () => {
    values.push(cell.trim())
    if (values.some(value => value !== '')) rows.push({ values, line: start })
    values = []; cell = ''; closed = false
  }
  for (let index = 0; index < csv.length; index++) {
    const character = csv[index]
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') { cell += '"'; index++ }
      else if (character === '"') { quoted = false; closed = true }
      else cell += character
    } else if (character === ',') { values.push(cell.trim()); cell = ''; closed = false }
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && csv[index + 1] === '\n') index++
      finish(); line++; start = line
    } else if (character === '"' && !cell && !closed) quoted = true
    else if (character === '"' || (closed && character.trim())) throw new Error(`Row ${start} has an invalid quoted value.`)
    else cell += character
    if (quoted && character === '\n') line++
  }
  if (quoted) throw new Error(`Row ${start} has an unclosed quoted value.`)
  if (cell || values.length || closed) finish()
  return rows
}

function timestampParser(timeZone: string) {
  let formatter: Intl.DateTimeFormat
  try {
    if (!timeZone.trim()) throw new Error('Empty timezone')
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  } catch {
    throw new Error('Choose a valid timezone.')
  }
  const localTime = (instant: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]))
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
  }
  const cache = new Map<string, number>()
  return (value: string, line: number) => {
    const cached = cache.get(value)
    if (cached !== undefined) return cached
    const match = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4}) at (\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
    if (!match) throw new Error(`Row ${line} has an invalid date and time.`)
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(match[1])
    const [, , day, year, hour, minute, second = '0'] = match
    const naive = Date.UTC(Number(year), month, Number(day), Number(hour), Number(minute), Number(second))
    const date = new Date(naive)
    if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== month || date.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) throw new Error(`Row ${line} has an invalid date and time.`)
    const candidates = new Set<number>()
    // Sample both sides of transitions, including half-hour and date-line changes.
    for (let hours = -48; hours <= 48; hours += 6) {
      const probe = naive + hours * 3_600_000
      const candidate = naive - (localTime(probe) - probe)
      if (localTime(candidate) === naive) candidates.add(candidate)
    }
    if (candidates.size !== 1) throw new Error(`Row ${line} has a ${candidates.size ? 'ambiguous' : 'nonexistent'} local date and time in ${timeZone}.`)
    const instant = [...candidates][0]
    cache.set(value, instant)
    return instant
  }
}

export function parseTradingViewTradeHistoryCsv(csv: string, timeZone: string): ImportedTrade[] {
  if (new TextEncoder().encode(csv).length > 2_000_000) throw new Error('CSV must be at most 2 MB.')
  const [header, ...rows] = csvRows(csv.replace(/^\uFEFF/, ''))
  if (!header) throw new Error('CSV is empty.')
  if (rows.length > 5000) throw new Error('CSV can contain at most 5000 trade rows.')
  const names = header.values.map(name => name.toLowerCase())
  if (new Set(names).size !== names.length) throw new Error('CSV has duplicate column names.')
  const required = ['symbol', 'trade number', 'type', 'date and time', 'order id', 'price', 'size (qty)', 'net pnl usd']
  if (required.some(name => !names.includes(name))) throw new Error(`CSV must include columns: ${required.join(', ')}.`)
  if (!rows.length) throw new Error('CSV has no trade rows.')
  const parseTime = timestampParser(timeZone)
  type SourceRow = { line: number; symbol: string; trade: string; side: 'long' | 'short'; order: string; price: string; quantity: string; pnl: string; time: number }
  const pairs = new Map<string, { entry?: SourceRow; exit?: SourceRow }>()
  const orders = new Set<string>()
  for (const { values, line } of rows) {
    if (values.length !== names.length) throw new Error(`Row ${line} has an invalid number of columns.`)
    const get = (name: string) => values[names.indexOf(name)]
    const symbol = get('symbol'), trade = get('trade number'), order = get('order id')
    if (!symbol) throw new Error(`Row ${line} has an invalid symbol.`)
    if (!/^[1-9]\d*$/.test(trade)) throw new Error(`Row ${line} has an invalid trade number.`)
    const type = /^(Entry|Exit) (long|short)$/.exec(get('type'))
    if (!type) throw new Error(`Row ${line} has an invalid type.`)
    const kind = type[1] === 'Entry' ? 'entry' : 'exit'
    const key = JSON.stringify([symbol, trade])
    const pair = pairs.get(key) ?? {}
    if (pair[kind]) throw new Error(`Row ${line} has a duplicate ${kind} for row ${pair[kind].line}.`)
    if (!order || orders.has(order)) throw new Error(`Row ${line} has a missing or duplicate order ID.`)
    orders.add(order)
    const numeric = (name: string, label: string, positive: boolean) => {
      const value = get(name)
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value)) || (positive && Number(value) <= 0)) throw new Error(`Row ${line} has an invalid ${label}.`)
      return value
    }
    const row: SourceRow = { line, symbol, trade, order, side: type[2] as 'long' | 'short', price: numeric('price', 'price', true), quantity: numeric('size (qty)', 'quantity', true), pnl: numeric('net pnl usd', 'P&L', false), time: parseTime(get('date and time'), line) }
    const other = pair.entry ?? pair.exit
    if (other && row.side !== other.side) throw new Error(`Row ${line} has a mismatched side with row ${other.line}.`)
    if (other && Number(row.quantity) !== Number(other.quantity)) throw new Error(`Row ${line} has a mismatched quantity with row ${other.line}.`)
    if (other && Number(row.pnl) !== Number(other.pnl)) throw new Error(`Row ${line} has mismatched P&L with row ${other.line}.`)
    pair[kind] = row
    pairs.set(key, pair)
  }
  return [...pairs.values()].map(({ entry, exit }) => {
    if (!entry || !exit) throw new Error(`Row ${(entry ?? exit)!.line} is missing its ${entry ? 'exit' : 'entry'} row.`)
    if (exit.time < entry.time) throw new Error(`Row ${exit.line} exits before entry row ${entry.line}.`)
    return { sourceKey: `tradingview:${JSON.stringify([entry.symbol, entry.trade, entry.order, exit.order])}`, symbol: entry.symbol, side: entry.side, entryPrice: entry.price, exitPrice: exit.price, openedAt: new Date(entry.time).toISOString(), sourcePnlUsd: exit.pnl, quantity: entry.quantity }
  })
}
