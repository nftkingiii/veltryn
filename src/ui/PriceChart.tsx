import { useState } from 'react'
import type { Candle } from '../providers/bitget'

const price = (value: number) => '$' + value.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})
const stages = ['Entry', 'First shock', 'Reprice', 'Thesis window']

export function PriceChart({ candles, calm, shock }: { candles: Candle[]; calm: number[]; shock: number[] }) {
  const [point, setPoint] = useState(1)
  const [candleIndex, setCandleIndex] = useState<number | null>(null)
  const history = candles.filter(c => c.slice(0,5).every(v => Number.isFinite(Number(v))) && Number(c[3]) > 0).slice().sort((a,b)=>Number(a[0])-Number(b[0])).slice(-24)
  const all = [...calm, ...shock, ...history.flatMap(c => [Number(c[2]),Number(c[3])])]
  const min = Math.min(...all), max = Math.max(...all), padding = (max-min)*0.12 || 1
  const bottom = min-padding, top = max+padding
  const y = (value: number) => 290-(value-bottom)/(top-bottom)*240
  const start = history.length ? 350 : 26
  const x = (i: number) => start + i*(710-start)/3
  const points = (values: number[]) => values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')
  const selected = candleIndex === null ? null : history[Math.min(candleIndex,history.length-1)]
  return <>
    <div className="chart-readout" aria-live="polite"><span>{selected ? 'Hourly candle' : stages[point]}</span><strong>{price(selected ? Number(selected[4]) : shock[point])}</strong><small>{selected ? `O ${price(Number(selected[1]))} · H ${price(Number(selected[2]))} · L ${price(Number(selected[3]))}` : `Shock path · calm ${price(calm[point])}`}</small></div>
    <div className="price-chart-scroll"><svg className="price-chart" viewBox="0 0 800 330" role="img" aria-label="Historical hourly candlesticks followed by calm and shock-recovery modeled paths. The vertical divider separates observed prices from scenarios.">
      <rect x={start} y="30" width={710-start} height="265" rx="8" fill="var(--accent)" opacity=".035" />
      {[0,1,2,3,4].map(i => <g key={i}><line x1="26" x2="710" y1={50+i*60} y2={50+i*60} stroke="var(--line)" strokeDasharray="3 5"/><text x="722" y={54+i*60} fill="var(--muted)" fontSize="11">{price(top-i*(top-bottom)/4)}</text></g>)}
      {history.length > 0 && <><text x="26" y="18" fill="var(--muted)" fontSize="11">OBSERVED · {history.length} × 1H CANDLES</text><line x1={start} x2={start} y1="28" y2="295" stroke="var(--muted)" strokeDasharray="4 5"/><text x="26" y="318" fill="var(--muted)" fontSize="11">{new Date(Number(history[0][0])).toLocaleDateString([], {month:'short',day:'numeric'})}</text></>}
      <text x={start+12} y="18" fill="var(--amber)" fontSize="11">MODELED · NOT A FORECAST</text>
      {history.map((c,i) => {const cx=30+i*300/Math.max(history.length-1,1);const open=Number(c[1]),close=Number(c[4]);const color=close>=open?'var(--teal)':'var(--red)';return <g key={c[0]}><line x1={cx} x2={cx} y1={y(Number(c[2]))} y2={y(Number(c[3]))} stroke={color} strokeWidth="1.2"/><rect x={cx-3.5} y={Math.min(y(open),y(close))} width="7" height={Math.max(1.5,Math.abs(y(open)-y(close)))} rx=".7" fill={color}/></g>})}
      <line x1={start} x2="710" y1={y(calm[0])} y2={y(calm[0])} stroke="var(--muted)" strokeDasharray="2 6" opacity=".4"/>
      <polyline points={points(calm)} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinejoin="round"/>
      <polyline points={points(shock)} fill="none" stroke="var(--amber)" strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="6 4"/>
      <line x1={selected ? 30+Math.min(candleIndex ?? 0,history.length-1)*300/Math.max(history.length-1,1) : x(point)} x2={selected ? 30+Math.min(candleIndex ?? 0,history.length-1)*300/Math.max(history.length-1,1) : x(point)} y1="30" y2="295" stroke="var(--muted)" strokeDasharray="3 5" opacity=".6"/>
      <circle cx={x(point)} cy={y(shock[point])} r="5" fill="var(--amber)" stroke="var(--panel)" strokeWidth="2"/>
      <text x={start+4} y="318" fill="var(--muted)" fontSize="11">Entry</text><text x="710" y="318" textAnchor="end" fill="var(--muted)" fontSize="11">Thesis window →</text>
    </svg></div>
    {history.length > 0 ? <label className="candle-inspector"><span>{selected ? new Date(Number(selected[0])).toLocaleString() : 'Inspect historical candles'}</span><input aria-label="Inspect historical candle" type="range" min="0" max={history.length-1} value={candleIndex ?? history.length-1} onChange={e=>setCandleIndex(Number(e.target.value))}/></label> : <p className="chart-empty">Historical candles unavailable. Showing modeled paths only.</p>}
    <div className="chart-stages">{stages.map((label,i)=><button key={label} aria-pressed={point===i && candleIndex===null} onClick={()=>{setPoint(i);setCandleIndex(null)}}>{label}</button>)}</div>
    <p className="chart-footnote">Candles show actual OHLC prices; the latest candle may still be forming. Scenario spacing represents stages, not elapsed hours.</p>
  </>
}
