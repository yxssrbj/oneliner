import type { SavedTrade } from '../../app/components/trade-edit-form'

export function demoTradesForWeek(week: string): SavedTrade[] {
  function opened(day: number, hour: number) {
    const date = new Date(`${week}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + day)
    return `${date.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:30:00Z`
  }

  return [
    { id: 'demo-nq', original_note: 'NQ long 20000 orb stop 19990', symbol: 'NQ', side: 'long', entry_price: '20000', stop_price: '19990', setup: 'Opening range breakout', opened_at: opened(0, 9), exit_price: '20020', r_result: '2' },
    { id: 'demo-cl', original_note: 'CL short 80.00 vwap stop 80.50', symbol: 'CL', side: 'short', entry_price: '80', stop_price: '80.5', setup: 'VWAP reclaim', opened_at: opened(1, 10), exit_price: '80.5', r_result: '-1' },
    { id: 'demo-es', original_note: 'ES long 5800 liquidity sweep stop 5795', symbol: 'ES', side: 'long', entry_price: '5800', stop_price: '5795', setup: 'Liquidity sweep', opened_at: opened(2, 8), exit_price: '5807.5', r_result: '1.5' },
    { id: 'demo-gc', original_note: 'GC short 2671.3 orb stop 2676.3', symbol: 'GC', side: 'short', entry_price: '2671.3', stop_price: '2676.3', setup: 'Opening range breakout', opened_at: opened(3, 14), exit_price: null, r_result: null },
    { id: 'demo-ym', original_note: 'YM long 42100 pullback stop 42090', symbol: 'YM', side: 'long', entry_price: '42100', stop_price: '42090', setup: 'Pullback', opened_at: opened(4, 11), exit_price: '42100', r_result: '0' },
  ]
}
