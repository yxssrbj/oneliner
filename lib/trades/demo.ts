import type { SavedTrade } from '../../app/components/trade-edit-form'

type SampleTrade = Omit<SavedTrade, 'opened_at'> & { day: number; hour: number }

const samples: Record<number, SampleTrade[]> = {
  0: [
    { id: 'demo-nq', original_note: 'NQ long 20000 orb stop 19990', symbol: 'NQ', side: 'long', entry_price: '20000', stop_price: '19990', setup: 'Opening range breakout', day: 0, hour: 9, exit_price: '20020', r_result: '2' },
    { id: 'demo-cl', original_note: 'CL short 80.00 vwap stop 80.50', symbol: 'CL', side: 'short', entry_price: '80', stop_price: '80.5', setup: 'VWAP reclaim', day: 1, hour: 10, exit_price: '80.5', r_result: '-1' },
    { id: 'demo-es', original_note: 'ES long 5800 liquidity sweep stop 5795', symbol: 'ES', side: 'long', entry_price: '5800', stop_price: '5795', setup: 'Liquidity sweep', day: 2, hour: 8, exit_price: '5807.5', r_result: '1.5' },
    { id: 'demo-gc', original_note: 'GC short 2671.3 orb stop 2676.3', symbol: 'GC', side: 'short', entry_price: '2671.3', stop_price: '2676.3', setup: 'Opening range breakout', day: 3, hour: 14, exit_price: null, r_result: null },
    { id: 'demo-ym', original_note: 'YM long 42100 pullback stop 42090', symbol: 'YM', side: 'long', entry_price: '42100', stop_price: '42090', setup: 'Pullback', day: 4, hour: 11, exit_price: '42100', r_result: '0' },
  ],
  [-1]: [
    { id: 'demo-prev-nq', original_note: 'NQ long 20100 opening range stop 20090', symbol: 'NQ', side: 'long', entry_price: '20100', stop_price: '20090', setup: 'Opening range breakout', day: 0, hour: 9, exit_price: '20120', r_result: '2' },
    { id: 'demo-prev-cl', original_note: 'CL short 79.20 vwap stop 79.70', symbol: 'CL', side: 'short', entry_price: '79.2', stop_price: '79.7', setup: 'VWAP reclaim', day: 1, hour: 10, exit_price: '79.7', r_result: '-1' },
    { id: 'demo-prev-es', original_note: 'ES short 5830 failed breakout stop 5835', symbol: 'ES', side: 'short', entry_price: '5830', stop_price: '5835', setup: 'Failed breakout', day: 2, hour: 8, exit_price: '5835', r_result: '-1' },
    { id: 'demo-prev-ym', original_note: 'YM long 42080 pullback stop 42070', symbol: 'YM', side: 'long', entry_price: '42080', stop_price: '42070', setup: 'Pullback', day: 3, hour: 11, exit_price: '42080', r_result: '0' },
    { id: 'demo-prev-gc', original_note: 'GC long 2680 liquidity sweep stop 2675', symbol: 'GC', side: 'long', entry_price: '2680', stop_price: '2675', setup: 'Liquidity sweep', day: 4, hour: 9, exit_price: null, r_result: null },
    { id: 'demo-prev-rty', original_note: 'RTY short 2112.4 orb stop 2114.4', symbol: 'RTY', side: 'short', entry_price: '2112.4', stop_price: '2114.4', setup: 'Opening range breakout', day: 4, hour: 13, exit_price: null, r_result: null },
  ],
  [-2]: [
    { id: 'demo-old-es', original_note: 'ES long 5790 orb stop 5785', symbol: 'ES', side: 'long', entry_price: '5790', stop_price: '5785', setup: 'Opening range breakout', day: 0, hour: 8, exit_price: '5797.5', r_result: '1.5' },
    { id: 'demo-old-nq', original_note: 'NQ short 19980 liquidity sweep stop 19990', symbol: 'NQ', side: 'short', entry_price: '19980', stop_price: '19990', setup: 'Liquidity sweep', day: 1, hour: 9, exit_price: '19970', r_result: '1' },
    { id: 'demo-old-cl', original_note: 'CL long 77.80 vwap stop 77.30', symbol: 'CL', side: 'long', entry_price: '77.8', stop_price: '77.3', setup: 'VWAP reclaim', day: 2, hour: 10, exit_price: '77.3', r_result: '-1' },
    { id: 'demo-old-gc', original_note: 'GC short 2660 pullback stop 2665', symbol: 'GC', side: 'short', entry_price: '2660', stop_price: '2665', setup: 'Pullback', day: 3, hour: 12, exit_price: '2657.5', r_result: '0.5' },
    { id: 'demo-old-ym', original_note: 'YM long 41940 failed breakdown stop 41930', symbol: 'YM', side: 'long', entry_price: '41940', stop_price: '41930', setup: 'Failed breakdown', day: 4, hour: 11, exit_price: '41940', r_result: '0' },
    { id: 'demo-old-rty', original_note: 'RTY short 2108.2 orb stop 2110.2', symbol: 'RTY', side: 'short', entry_price: '2108.2', stop_price: '2110.2', setup: 'Opening range breakout', day: 4, hour: 14, exit_price: null, r_result: null },
  ],
}

export function demoTradesForWeek(week: string, baseWeek: string): SavedTrade[] {
  const offset = Math.round((Date.parse(`${week}T00:00:00Z`) - Date.parse(`${baseWeek}T00:00:00Z`)) / 604_800_000)
  return (samples[offset] ?? []).map(({ day, hour, ...trade }) => {
    const date = new Date(`${week}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + day)
    return { ...trade, opened_at: `${date.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:30:00Z` }
  })
}
