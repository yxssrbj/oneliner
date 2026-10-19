export type ChartBar = {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number | null
}

const maximumRows = 5000

export function validateChartBars(value: unknown): ChartBar[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximumRows) return null
  const bars: ChartBar[] = []
  let previousTime = -Infinity
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const bar = item as Record<string, unknown>
    if (typeof bar.time !== 'string' || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(bar.time)) return null
    const timestamp = Date.parse(bar.time)
    const [open, high, low, close] = [bar.open, bar.high, bar.low, bar.close]
    const prices = [open, high, low, close]
    if (!Number.isFinite(timestamp) || timestamp <= previousTime || prices.some(price => typeof price !== 'number' || !Number.isFinite(price)) || (high as number) < Math.max(open as number, close as number) || (low as number) > Math.min(open as number, close as number) || (high as number) < (low as number)) return null
    if (bar.volume !== null && (typeof bar.volume !== 'number' || !Number.isFinite(bar.volume) || bar.volume < 0)) return null
    previousTime = timestamp
    bars.push({ time: new Date(timestamp).toISOString(), open: open as number, high: high as number, low: low as number, close: close as number, volume: bar.volume as number | null })
  }
  return bars
}

function rowsFromCsv(csv: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < csv.length; index++) {
    const character = csv[index]
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') { cell += '"'; index++ }
      else if (character === '"') quoted = false
      else cell += character
    } else if (character === '"' && cell === '') quoted = true
    else if (character === ',') { row.push(cell.trim()); cell = '' }
    else if (character === '\n') {
      row.push(cell.trim()); rows.push(row)
      row = []; cell = ''
    } else if (character !== '\r') cell += character
  }

  if (quoted) throw new Error('CSV contains an unclosed quoted value.')
  if (cell || row.length) { row.push(cell.trim()); rows.push(row) }
  return rows.filter(values => values.some(value => value !== ''))
}

export function parseTradingViewChartCsv(csv: string): ChartBar[] {
  if (csv.length > 2_000_000) throw new Error('CSV must be smaller than 2 MB.')
  const rows = rowsFromCsv(csv.replace(/^\uFEFF/, ''))
  const [header, ...data] = rows
  if (!header) throw new Error('CSV is empty.')
  if (data.length > maximumRows) throw new Error('CSV can contain at most 5000 chart rows.')

  const columns = new Map(header.map((name, index) => [name.toLowerCase(), index]))
  const timeColumn = columns.get('time') ?? columns.get('date')
  const openColumn = columns.get('open')
  const highColumn = columns.get('high')
  const lowColumn = columns.get('low')
  const closeColumn = columns.get('close')
  const volumeColumn = columns.get('volume')
  if ([timeColumn, openColumn, highColumn, lowColumn, closeColumn].some(column => column === undefined)) {
    throw new Error('CSV must include time, open, high, low, and close columns.')
  }

  const bars = data.map((values, index) => {
    const line = index + 2
    const timestamp = values[timeColumn!]
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp ?? '')
    const time = hasTimezone ? Date.parse(timestamp) : Number.NaN
    const prices = [openColumn, highColumn, lowColumn, closeColumn].map(column => Number(values[column!]))
    const [open, high, low, close] = prices
    const volumeText = volumeColumn === undefined ? '' : values[volumeColumn]
    const volume = volumeText?.trim() ? Number(volumeText) : null

    if (!Number.isFinite(time)) throw new Error(`Row ${line} has an invalid timestamp or missing timezone.`)
    if (prices.some((price, priceIndex) => !values[[openColumn, highColumn, lowColumn, closeColumn][priceIndex]!]?.trim() || !Number.isFinite(price)) || high < Math.max(open, close) || low > Math.min(open, close) || high < low) {
      throw new Error(`Row ${line} has invalid OHLC prices.`)
    }
    if (volume !== null && (!Number.isFinite(volume) || volume < 0)) throw new Error(`Row ${line} has invalid volume.`)

    return { time: new Date(time).toISOString(), open, high, low, close, volume }
  })

  if (!bars.length) throw new Error('CSV has no chart rows.')
  return bars.sort((left, right) => left.time.localeCompare(right.time))
}
