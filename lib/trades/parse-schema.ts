import { isPrice } from './validation'
export type ParseSuggestion = { symbol: string | null; side: 'long' | 'short' | null; entryPrice: string | null; stopPrice: string | null; setup: string | null; clarifications: string[] }
const fields = { symbol: 'symbol', side: 'direction (long or short)', entryPrice: 'entry price', stopPrice: 'initial stop price', setup: 'setup name' } as const
export const suggestionSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    symbol: { type: ['string', 'null'] }, side: { type: ['string', 'null'], enum: ['long', 'short', null] },
    entryPrice: { type: ['string', 'null'] }, stopPrice: { type: ['string', 'null'] }, setup: { type: ['string', 'null'] },
    clarifications: { type: 'array', items: { type: 'string' } },
  }, required: [...Object.keys(fields), 'clarifications'],
}
export function normalizeSuggestion(input: unknown): ParseSuggestion {
  if (!input || typeof input !== 'object') throw new Error('Invalid suggestion')
  const data = input as ParseSuggestion
  if (!Array.isArray(data.clarifications) || data.clarifications.some((item) => typeof item !== 'string' || item.length > 500) || data.clarifications.length > 10) throw new Error('Invalid clarifications')
  const result = { ...data, clarifications: [...data.clarifications] }
  for (const [field, label] of Object.entries(fields)) {
    const key = field as keyof typeof fields
    const value = data[key]
    if (value !== null && (typeof value !== 'string' || value.length > (key === 'setup' ? 120 : 40))) throw new Error('Invalid suggestion field')
    if (key === 'side' && value !== null && value !== 'long' && value !== 'short') throw new Error('Invalid direction')
    if (value === null || !value.trim() || ((key === 'entryPrice' || key === 'stopPrice') && !isPrice(value))) {
      result[key] = null
      result.clarifications.push(`Please confirm the ${label}.`)
    }
  }
  return result
}
