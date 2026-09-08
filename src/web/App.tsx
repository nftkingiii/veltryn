import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BookOpen, CircleHelp, Clock3, Copy, Database, LineChart, RotateCcw, Save, ShieldCheck, Sparkles, Trash2, X } from '../ui/icons'
import { getCandles, getTicker, listRwaInstruments, type Candle, type Instrument, type Ticker } from '../providers/bitget'
import { makePath, stressPath, type Direction, type PositionPlan, type StressResult } from '../domain/engine'
import { loadRehearsalsWithFallback, persistRehearsalWithFallback, removeRehearsalWithFallback, type RehearsalRecord } from '../domain/storage'

const fallbackInstruments: Instrument[] = [
  { symbol: 'NVDAUSDT', baseCoin: 'NVDA', quoteCoin: 'USDT', isRwa: 'YES', minTradeNum: '0.01', minTradeUSDT: '5', makerFeeRate: '0.0002', takerFeeRate: '0.0006', fundInterval: '8', maxLever: '100', pricePlace: '2', volumePlace: '2' },
  { symbol: 'TSLAUSDT', baseCoin: 'TSLA', quoteCoin: 'USDT', isRwa: 'YES', minTradeNum: '0.01', minTradeUSDT: '5', makerFeeRate: '0.0002', takerFeeRate: '0.0006', fundInterval: '8', maxLever: '100', pricePlace: '2', volumePlace: '2' },
  { symbol: 'AAPLUSDT', baseCoin: 'AAPL', quoteCoin: 'USDT', isRwa: 'YES', minTradeNum: '0.01', minTradeUSDT: '5', makerFeeRate: '0.0002', takerFeeRate: '0.0006', fundInterval: '8', maxLever: '100', pricePlace: '2', volumePlace: '2' },
]

const money = (value: number) => `${value < 0 ? '−' : ''}$${Math.abs(value).toFixed(2)}`
const pct = (value: number) => `${value < 0 ? '−' : ''}${Math.abs(value * 100).toFixed(2)}%`

function Sparkline({ calm, shock }: { calm: number[]; shock: number[] }) {
  const all = [...calm, ...shock]
  const min = Math.min(...all), max = Math.max(...all)
  const points = (values: number[]) => values.map((value, index) => `${(index / (values.length - 1)) * 100},${100 - ((value - min) / (max - min || 1)) * 78 - 10}`).join(' ')
  return <svg className="path-chart" viewBox="0 0 100 100" role="img" aria-label="Comparison of two price paths ending at the same price">
    <defs><linearGradient id="chart-grid" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#203235" /><stop offset="1" stopColor="#111719" /></linearGradient></defs>
    <rect width="100" height="100" rx="4" fill="url(#chart-grid)" />
    {[20, 40, 60, 80].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#294043" strokeWidth=".35" />)}
    <polyline points={points(calm)} fill="none" stroke="#79cbb5" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    <polyline points={points(shock)} fill="none" stroke="#e7a963" strokeWidth="1.5" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
  </svg>
}

export function App() {
  const [tab, setTab] = useState<'rehearse' | 'library' | 'methodology'>('rehearse')
  const [instruments, setInstruments] = useState<Instrument[]>(fallbackInstruments)
  const [selected, setSelected] = useState('NVDAUSDT')
  const [ticker, setTicker] = useState<Ticker | null>(null)
  const [candles, setCandles] = useState<Candle[]>([])
  const [providerState, setProviderState] = useState<'loading' | 'live' | 'fallback' | 'error'>('loading')
  const [direction, setDirection] = useState<Direction>('long')
  const [quantity, setQuantity] = useState(0.1)
  const [collateral, setCollateral] = useState(1000)
  const [lossBudget, setLossBudget] = useState(180)
  const [endpointMove, setEndpointMove] = useState(0.06)
  const [dipMove, setDipMove] = useState(0.09)
  const [thesis, setThesis] = useState('The catalyst resolves in my direction, but I need to know whether the position survives the path there.')
  const [rehearsals, setRehearsals] = useState<RehearsalRecord[]>([])
  const [workspaceMode, setWorkspaceMode] = useState<'server' | 'browser'>('browser')
  const [activeRehearsalId, setActiveRehearsalId] = useState<string | undefined>()
  const [saved, setSaved] = useState(false)
  const [showMethod, setShowMethod] = useState(false)
  const snapshotLocked = useRef(false)

  useEffect(() => { loadRehearsalsWithFallback().then(({ records, mode }) => { setRehearsals(records); setWorkspaceMode(mode) }) }, [])

  useEffect(() => {
    if (snapshotLocked.current) return
    let cancelled = false
    Promise.all([listRwaInstruments(), getTicker(selected), getCandles(selected)])
      .then(([items, live, history]) => { if (!cancelled && !snapshotLocked.current) { const supported = items.filter((item) => ['NVDAUSDT', 'TSLAUSDT', 'AAPLUSDT'].includes(item.symbol)); setInstruments(supported.length ? supported : items.slice(0, 3)); setTicker(live.ticker); setCandles(history.candles); setProviderState('live') } })
      .catch(() => { if (!cancelled && !snapshotLocked.current) setProviderState('fallback') })
    return () => { cancelled = true }
  }, [selected])

  const liveEntry = ticker ? Number(ticker.lastPr) : 232.5
  const plan = useMemo<PositionPlan>(() => ({ direction, entryPrice: liveEntry, quantity, collateral, lossBudget, feeRate: 0.0006, fundingRate: ticker ? Number(ticker.fundingRate) : 0, fundingPeriods: 3 }), [direction, liveEntry, quantity, collateral, lossBudget, ticker])
  const calm = makePath(liveEntry, direction, endpointMove, endpointMove * 0.25)
  const shock = makePath(liveEntry, direction, endpointMove, dipMove)
  const calmResult = stressPath(plan, calm)
  const shockResult = stressPath(plan, shock)
  const leverage = liveEntry * quantity / collateral
  const historicalReturn = candles.length > 1 ? (Number(candles[candles.length - 1][4]) / Number(candles[0][1])) - 1 : null

  const updateNumber = (setter: (v: number) => void) => (event: React.ChangeEvent<HTMLInputElement>) => setter(Number(event.target.value))
  const reportStatus = (result: StressResult) => result.status === 'within-budget' ? 'Within budget' : result.status === 'stop-triggered' ? 'Stop triggered' : 'Budget breached'
  const saveCurrent = () => {
    persistRehearsalWithFallback({ symbol: selected, direction, quantity, collateral, lossBudget, endpointMove, dipMove, thesis, providerState: ticker ? 'live' : 'fallback', ticker, candles }, activeRehearsalId).then(({ record, mode }) => { setRehearsals((current) => [record, ...current.filter((item) => item.id !== record.id)]); setWorkspaceMode(mode); setActiveRehearsalId(record.id); setSaved(true) })
  }
  const openRehearsal = (record: RehearsalRecord) => {
    snapshotLocked.current = true
    setActiveRehearsalId(record.id); setSelected(record.symbol); setDirection(record.direction); setQuantity(record.quantity); setCollateral(record.collateral); setLossBudget(record.lossBudget); setEndpointMove(record.endpointMove); setDipMove(record.dipMove); setThesis(record.thesis); setTicker(record.ticker); setCandles(record.candles); setProviderState(record.providerState); setTab('rehearse')
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Veltryn home"><span className="brand-mark"><span /></span><span>veltryn</span></a>
      <nav className="main-nav" aria-label="Primary navigation">
        <button className={tab === 'rehearse' ? 'active' : ''} onClick={() => setTab('rehearse')}>Rehearse</button>
        <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>Library</button>
        <button className={tab === 'methodology' ? 'active' : ''} onClick={() => setTab('methodology')}>Methodology</button>
      </nav>
      <div className="top-actions"><span className={`live-chip ${providerState}`}><span className="status-dot" />{providerState === 'live' ? 'Bitget live data' : providerState === 'fallback' ? 'Recorded example' : providerState === 'error' ? 'Data unavailable' : 'Connecting'}</span><button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button></div>
    </header>
    <main id="top">
      {tab === 'rehearse' && <>
        <section className="hero-row"><div><p className="kicker">DECISION STRESS TESTING <span>·</span> HUMAN IN THE LOOP</p><h1>Rehearse the trade.</h1><p className="hero-copy">A correct direction can still be a bad position. Test the path your thesis must survive before you commit capital.</p></div><div className="hero-note"><ShieldCheck size={18} /><div><strong>Read-only by design</strong><span>Veltryn researches and models. You decide.</span></div></div></section>
        <section className="workspace-grid">
          <aside className="plan-panel panel"><div className="panel-heading"><div><span className="step-label">01 / POSITION</span><h2>State the trade</h2></div><button className="text-button" onClick={() => { snapshotLocked.current = false; setActiveRehearsalId(undefined); setQuantity(0.1); setCollateral(1000); setLossBudget(180) }}><RotateCcw size={14} /> Reset</button></div>
                <label>Instrument<select value={selected} onChange={(e) => { snapshotLocked.current = false; setActiveRehearsalId(undefined); setSelected(e.target.value) }}>{instruments.filter((item) => item.isRwa === 'YES').map((item) => <option key={item.symbol} value={item.symbol}>{item.baseCoin} / USDT perpetual</option>)}</select></label>
            <div className="segmented" aria-label="Direction"><button className={direction === 'long' ? 'selected long' : ''} onClick={() => setDirection('long')}><ArrowUpRight size={16} /> Long</button><button className={direction === 'short' ? 'selected short' : ''} onClick={() => setDirection('short')}><ArrowDownRight size={16} /> Short</button></div>
            <div className="field-grid"><label>Quantity<input type="number" min="0.01" step="0.01" value={quantity} onChange={updateNumber(setQuantity)} /></label><label>Collateral<div className="input-wrap"><input type="number" min="1" step="10" value={collateral} onChange={updateNumber(setCollateral)} /><span className="input-suffix">USDT</span></div></label></div>
            <div className="field-grid"><label>Loss budget<div className="input-wrap"><input type="number" min="1" step="10" value={lossBudget} onChange={updateNumber(setLossBudget)} /><span className="input-suffix">USDT</span></div></label><label>Thesis endpoint<div className="input-wrap"><input type="number" min="0.01" max="0.5" step="0.01" value={endpointMove} onChange={updateNumber(setEndpointMove)} /><span className="input-suffix">%</span></div></label></div>
            <label className="thesis-label">Your thesis<textarea value={thesis} onChange={(event) => setThesis(event.target.value)} /></label>
            <div className="plan-foot"><span>Estimated leverage <strong>{leverage.toFixed(2)}×</strong></span><span>Entry <strong>{money(liveEntry)}</strong></span></div>
            <button className="primary-button" onClick={() => setShowMethod(true)}><Sparkles size={16} /> Stress-test this position <span>↗</span></button>
          </aside>
          <section className="results-column"><div className="market-strip panel"><div className="market-id"><span className="asset-icon">{selected.slice(0, 2)}</span><div><strong>{selected.replace('USDT', '')} / USDT</strong><span>Bitget stock perpetual · {providerState === 'live' ? 'observed now' : 'illustrative snapshot'}</span></div></div><div className="market-stat"><span>Mark price</span><strong>{money(ticker ? Number(ticker.markPrice) : liveEntry)}</strong></div><div className="market-stat"><span>Funding / 8h</span><strong className={Number(ticker?.fundingRate ?? 0) > 0 ? 'warning-text' : ''}>{ticker ? pct(Number(ticker.fundingRate)) : '0.00%'}</strong></div><div className="market-stat"><span>Data captured</span><strong>{ticker ? new Date(Number(ticker.ts)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Example'}</strong></div></div>
            <div className="result-header"><div><span className="step-label">02 / PATH TEST</span><h2>Same destination. Different survival.</h2><p>Both scenarios finish at your {pct(endpointMove)} thesis endpoint. The dashed path tests the shock you must survive first.</p></div><div className="result-actions"><button className="icon-button" aria-label="Save rehearsal" onClick={saveCurrent}><Save size={17} /></button><button className="outline-button" onClick={saveCurrent}><Copy size={15} /> {activeRehearsalId ? 'Save revision' : 'Save rehearsal'}</button></div></div>
            <div className="chart-card panel"><div className="chart-meta"><div className="legend"><span><i className="legend-line calm" />Calm path</span><span><i className="legend-line shock" />Shock → recovery</span></div><span className="chart-tag">MODELED PATHS</span></div><Sparkline calm={calm.map((p) => p.price)} shock={shock.map((p) => p.price)} /><div className="chart-axis"><span>Entry</span><span>Shock</span><span>Reprice</span><span>Thesis window</span></div></div>
            <div className="outcome-grid"><OutcomeCard label="Calm path" result={calmResult} color="teal" /><OutcomeCard label="Shock → recovery" result={shockResult} color="amber" /></div>
            <div className="evidence-card panel"><div className="evidence-heading"><div className="source-icon"><Database size={16} /></div><div><strong>What the model used</strong><span>Evidence is separated from the scenario assumptions.</span></div><button className="text-button" onClick={() => setTab('methodology')}>View method <ArrowUpRight size={14} /></button></div><div className="evidence-grid"><div><span className="evidence-label">Observed from Bitget</span><strong>{ticker ? 'Mark, index, ticker and funding' : 'Example snapshot only'}</strong><small>{ticker ? 'Live public market endpoint · captured now' : 'Provider unavailable for this session'}</small></div><div><span className="evidence-label">Modeled assumption</span><strong>{pct(dipMove)} adverse dip</strong><small>Deterministic path · not a forecast</small></div><div><span className="evidence-label">Historical context</span><strong>{historicalReturn === null ? 'Insufficient history' : `${pct(historicalReturn)} window move`}</strong><small>{candles.length ? `${candles.length} hourly candles observed` : 'No replay loaded'}</small></div></div></div>
          </section>
        </section>
        {showMethod && <div className="drawer-backdrop" onClick={() => setShowMethod(false)}><aside className="method-drawer" onClick={(event) => event.stopPropagation()}><button className="drawer-close" aria-label="Close method" onClick={() => setShowMethod(false)}><X size={18} /></button><span className="step-label">MODEL NOTE</span><h2>How this rehearsal works</h2><p>Veltryn separates observed Bitget market data from deterministic scenario assumptions. It does not predict the market or place orders.</p><div className="formula"><span>position PnL</span><strong>direction × quantity × (mark − entry)</strong></div><div className="formula"><span>equity</span><strong>collateral + PnL − fees − funding</strong></div><p className="small-copy">This first slice uses a linear isolated position and a taker-fee estimate. Exact liquidation is disabled until maintenance-margin parameters are verified from an authoritative source.</p></aside></div>}
        {saved && <button className="toast" onClick={() => setSaved(false)}><Save size={15} /> Rehearsal saved locally for this session</button>}
      </>}
      {tab === 'library' && <section className="content-page"><span className="step-label">LIBRARY · {workspaceMode === 'server' ? 'ANONYMOUS WORKSPACE' : 'BROWSER FALLBACK'}</span><h1>Your rehearsals.</h1><p>{workspaceMode === 'server' ? 'Your anonymous workspace is backed by the local Veltryn API. Records retain their captured market snapshot and ownership is enforced by an HttpOnly session.' : 'The workspace API is unavailable, so this browser is using local persistence. Records retain their captured market snapshot until the API is available.'}</p>{rehearsals.length === 0 ? <div className="empty-state"><BookOpen size={22} /><strong>No saved rehearsals yet</strong><span>Run a position test from Rehearse and save it to begin.</span><button className="outline-button" onClick={() => setTab('rehearse')}>Start a rehearsal</button></div> : <div className="library-list">{rehearsals.map((record) => <article className="library-row" key={record.id} onClick={() => openRehearsal(record)}><div><span className="library-symbol">{record.symbol.replace('USDT', '')} · {record.direction}</span><strong>{record.thesis || 'Untitled rehearsal'}</strong><small>{new Date(record.updatedAt).toLocaleString()} · revision {record.revision} · {record.providerState === 'live' ? 'Bitget snapshot' : 'Recorded example'}</small></div><button className="icon-button" aria-label={`Delete ${record.symbol} rehearsal`} onClick={(event) => { event.stopPropagation(); removeRehearsalWithFallback(record.id).then(({ records, mode }) => { setRehearsals(records); setWorkspaceMode(mode); if (activeRehearsalId === record.id) setActiveRehearsalId(undefined) }) }}><Trash2 size={16} /></button></article>)}</div>}</section>}
      {tab === 'methodology' && <section className="content-page"><span className="step-label">METHODOLOGY</span><h1>Make the assumptions visible.</h1><p>Veltryn is a research workbench for human decisions. Every result will show what was observed, what was modeled, and where the evidence is insufficient.</p><div className="method-grid"><div className="method-block"><LineChart size={20} /><h3>Path, not just endpoint</h3><p>A trade can finish at the expected price after violating its loss budget. We render the path and mark the first breach.</p></div><div className="method-block"><Clock3 size={20} /><h3>Funding has a timestamp</h3><p>Funding is applied only at modeled settlement events. Rates held constant for a scenario are labeled assumptions.</p></div><div className="method-block"><AlertTriangle size={20} /><h3>Unknowns stay unknown</h3><p>Missing margin tiers, insufficient depth, and ambiguous candle order produce an explicit limitation instead of invented precision.</p></div></div></section>}
    </main>
    <footer><span>VELTRYN / PRIVATE RESEARCH PREVIEW</span><span>Built for Bitget AI Base Camp S2 · AI Trading Desk</span></footer>
  </div>
}

function OutcomeCard({ label, result, color }: { label: string; result: StressResult; color: 'teal' | 'amber' }) {
  return <article className={`outcome-card ${color}`}><div className="outcome-top"><span>{label}</span><strong>{reportLabel(result)}</strong></div><div className="outcome-number">{money(result.terminalPnl)}</div><div className="outcome-caption">Terminal modeled PnL</div><div className="outcome-details"><span>Worst drawdown <b>{money(-result.worstDrawdown)}</b></span><span>Loss budget <b>{result.budgetBreachAt ? result.budgetBreachAt : 'Not breached'}</b></span><span>Fees + funding <b>{money(-(result.fees + result.funding))}</b></span></div></article>
}

function reportLabel(result: StressResult) { return result.status === 'within-budget' ? 'WITHIN BUDGET' : result.status === 'stop-triggered' ? 'STOP TRIGGERED' : 'BUDGET BREACHED' }
