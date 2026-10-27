'use client'

import { useState } from 'react'
import Link from 'next/link'
import { buildWeeklyReview } from '../../lib/trades/review'
import type { SavedTrade } from './trade-edit-form'

const formatR = (value: number | null) => value === null ? 'Unavailable' : `${value > 0 ? '+' : ''}${value.toFixed(2)}R`

export default function WeeklyReview({ week, trades, onSelect }: { week: string; trades: SavedTrade[]; onSelect: (id: string) => void }) {
  const { trades: selected, metrics, points, days, setups } = buildWeeklyReview(trades, week)
  const [focusedPoint, setFocusedPoint] = useState<number | null>(null)
  const values = points.map(point => point.totalR)
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const span = max - min || 1
  const x = (index: number) => 35 + index / Math.max(1, points.length - 1) * 530
  const y = (value: number) => 165 - (value - min) / span * 130
  const ordered = [...selected].sort((a, b) => Date.parse(b.opened_at) - Date.parse(a.opened_at) || b.id.localeCompare(a.id))
  const largestSetup = Math.max(1, ...setups.map(setup => Math.abs(setup.totalR)))
  return <div className="weekly-review">
    <dl className="review-metrics">
      <div><dt>Total R</dt><dd>{formatR(metrics.totalR)}</dd></div>
      <div><dt>Win rate</dt><dd>{metrics.winRate === null ? 'Unavailable' : `${(metrics.winRate * 100).toFixed(1)}%`}</dd></div>
      <div><dt>Average R</dt><dd>{formatR(metrics.averageR)}</dd></div>
      <div><dt>Best trade</dt><dd>{formatR(metrics.bestR)}</dd></div>
      <div><dt>Completed</dt><dd>{metrics.completedCount}</dd></div>
      <div><dt>Unfinished</dt><dd>{metrics.unfinishedCount}</dd></div>
    </dl>
    <div className="review-panels">
      <section className="review-panel review-chart"><h2>Cumulative R</h2><p>Completed trades in opening order · R is return relative to initial risk.</p>
        {points.length ? <>
          <svg viewBox="0 0 600 190" role="img" aria-label={`Cumulative R chart, ending at ${formatR(metrics.totalR)}`}>
            <line x1="35" y1={y(0)} x2="565" y2={y(0)} className="review-zero" />
            <polyline points={points.map((point, index) => `${x(index)},${y(point.totalR)}`).join(' ')} className="review-line" />
            {points.map((point, index) => <circle
              key={point.tradeId ?? 'start'} cx={x(index)} cy={y(point.totalR)} r="5"
              className="review-point" tabIndex={0}
              aria-label={point.tradeId ? `Trade ${index}: ${formatR(point.resultR)}, cumulative ${formatR(point.totalR)}` : 'Week start: 0.00R'}
              onFocus={() => setFocusedPoint(index)} onMouseEnter={() => setFocusedPoint(index)}
              onBlur={() => setFocusedPoint(null)} onMouseLeave={() => setFocusedPoint(null)}
            />)}
          </svg>
          <p className="review-chart-detail" role="status">{focusedPoint === null ? `${metrics.completedCount} completed · ${formatR(metrics.totalR)} total` : focusedPoint === 0 ? 'Week start · 0.00R' : `Trade ${focusedPoint} · ${formatR(points[focusedPoint].resultR)} · ${formatR(points[focusedPoint].totalR)} cumulative`}</p>
        </> : <p>No completed trades to chart.</p>}
      </section>
      <section className="review-panel"><h2>By setup</h2>
        {setups.length ? <div className="review-setups">{setups.map(setup => <div className="review-setup" key={setup.name}>
          <div><strong>{setup.name}</strong><b className={setup.totalR > 0 ? 'outcome-win' : setup.totalR < 0 ? 'outcome-loss' : ''}>{setup.completedCount ? formatR(setup.totalR) : '—'}</b></div>
          <div className="review-setup-track"><span className={setup.totalR < 0 ? 'outcome-loss' : ''} style={{ width: `${Math.min(100, Math.abs(setup.totalR) / largestSetup * 100)}%` }} /></div>
          <p>{setup.completedCount} completed · {setup.wins} won{setup.unfinishedCount ? ` · ${setup.unfinishedCount} unfinished` : ''}</p>
        </div>)}</div> : <p>No setups recorded this week.</p>}
      </section>
    </div>
    <section><h2>Each day</h2><div className="review-days">{days.map(day => <article className="review-day" key={day.date}>
      <time dateTime={day.date}>{new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })}<small>{day.date.slice(5)}</small></time>
      <strong className={day.totalR > 0 ? 'outcome-win' : day.totalR < 0 ? 'outcome-loss' : ''}>{day.completedCount ? formatR(day.totalR) : '—'}</strong>
      <p>{day.completedCount} closed{day.unfinishedCount ? ` · ${day.unfinishedCount} unfinished` : ''}</p>
    </article>)}</div></section>
    {metrics.unfinishedCount > 0 && <aside className="review-unfinished">
      <div><strong>{metrics.unfinishedCount} {metrics.unfinishedCount === 1 ? 'trade needs' : 'trades need'} an exit</strong><p>Unfinished trades stay out of performance results.</p></div>
      <Link href="/inbox">Finish {metrics.unfinishedCount} unfinished {metrics.unfinishedCount === 1 ? 'trade' : 'trades'} →</Link>
    </aside>}
    <section>
      <div className="review-section-head"><h2>Trades opened this week</h2><span>{selected.length} recorded</span></div>
      {ordered.length ? <div className="review-table-wrap"><table aria-label="Trades opened this week">
        <thead><tr><th scope="col">Trade</th><th scope="col">Opened (UTC)</th><th scope="col">Setup & note</th><th scope="col">Entry → exit</th><th scope="col">Result</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
        <tbody>{ordered.map(trade => <tr key={trade.id}>
          <td><strong>{trade.symbol}</strong> <span>{trade.side}</span></td>
          <td><time dateTime={trade.opened_at}>{new Date(trade.opened_at).toISOString().slice(0, 16).replace('T', ' ')}</time></td>
          <td><strong>{trade.setup}</strong><p>{trade.original_note}</p></td>
          <td>{trade.entry_price} → {trade.exit_price ?? '—'}</td>
          <td className={trade.r_result === null ? '' : Number(trade.r_result) > 0 ? 'outcome-win' : Number(trade.r_result) < 0 ? 'outcome-loss' : ''}>{trade.r_result === null ? 'Needs exit' : formatR(Number(trade.r_result))}</td>
          <td><button type="button" onClick={() => onSelect(trade.id)} aria-label={`Review ${trade.symbol} trade ${trade.id}`}>Review</button></td>
        </tr>)}</tbody>
      </table></div> : <p>No trades opened this week.</p>}
    </section>
  </div>
}
