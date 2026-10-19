export type TradeDraft = { originalNote: string; symbol: string; side: 'long' | 'short' | ''; entryPrice: string; stopPrice: string; setup: string; openedAt: string }

export function validateNote(note: unknown): string | null {
  return typeof note !== 'string' || !note.trim() || note.length > 1000 ? 'Enter a note of 1–1,000 characters.' : null
}

export function isPrice(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) && Number.isFinite(Number(value)) && Number(value) > 0
}

export function comparePrices(left: string, right: string): number {
  const [leftWhole, leftFraction = ''] = left.split('.')
  const [rightWhole, rightFraction = ''] = right.split('.')
  const precision = Math.max(leftFraction.length, rightFraction.length)
  const difference = BigInt((leftWhole || '0') + leftFraction.padEnd(precision, '0')) - BigInt((rightWhole || '0') + rightFraction.padEnd(precision, '0'))
  return difference < BigInt(0) ? -1 : difference > BigInt(0) ? 1 : 0
}

export function validateDraft(input: unknown): { value: TradeDraft; error?: never } | { error: string; value?: never } {
  if (!input || typeof input !== 'object') return { error: 'Check the trade fields.' }
  const draft = input as TradeDraft
  const noteError = validateNote(draft.originalNote)
  if (noteError) return { error: noteError }
  if (typeof draft.symbol !== 'string' || !draft.symbol.trim() || draft.symbol.length > 40) return { error: 'Enter a symbol (up to 40 characters).' }
  if (draft.side !== 'long' && draft.side !== 'short') return { error: 'Choose long or short.' }
  if (!isPrice(draft.entryPrice) || !isPrice(draft.stopPrice)) return { error: 'Entry and stop must be positive decimal prices.' }
  if (draft.side === 'long' ? comparePrices(draft.stopPrice, draft.entryPrice) >= 0 : comparePrices(draft.stopPrice, draft.entryPrice) <= 0) return { error: 'Place the initial stop below entry for a long, or above entry for a short.' }
  if (typeof draft.setup !== 'string' || !draft.setup.trim() || draft.setup.length > 120) return { error: 'Enter a setup name (up to 120 characters).' }
  if (typeof draft.openedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(draft.openedAt) || !Number.isFinite(Date.parse(draft.openedAt))) return { error: 'Enter a valid opening date and time.' }
  if (new Date(draft.openedAt.slice(0, 10)).toISOString().slice(0, 10) !== draft.openedAt.slice(0, 10)) return { error: 'Enter a valid opening date and time.' }
  return { value: { originalNote: draft.originalNote, symbol: draft.symbol, side: draft.side, entryPrice: draft.entryPrice, stopPrice: draft.stopPrice, setup: draft.setup, openedAt: draft.openedAt } }
}
