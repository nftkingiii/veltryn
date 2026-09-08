import { fallbackInstruments, supportedSymbols } from '../domain/instruments'
import { AssetLogo, InstrumentPicker } from '../ui/InstrumentPicker'
import { PriceChart } from '../ui/PriceChart'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BookOpen, CircleHelp, Clock3, Copy, Database, LineChart, RotateCcw, Save, ShieldCheck, Sparkles, Trash2, X } from '../ui/icons'
import { getCandles, getTicker, listRwaInstruments, type Candle, type Instrument, type Ticker } from '../providers/bitget'
import { makePath, stressPath, type Direction, type PositionPlan, type StressResult } from '../domain/engine'
import { loadRehearsalsWithFallback, persistRehearsalWithFallback, removeRehearsalWithFallback, type RehearsalRecord, type ResearchSource } from '../domain/storage'
import { createRemoteShare, loadPublicReport, revokeRemoteShare, verifyRemoteSource } from '../providers/workspace'

const money = (value: number) => `${value < 0 ? '−' : ''}$${Math.abs(value).toFixed(2)}`
const pct = (value: number) => `${value < 0 ? '−' : ''}${Math.abs(value * 100).toFixed(2)}%`
const valueToText = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value) ?? ''
export function App() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('veltryn.theme') || 'dark' } catch { return 'dark' } })
  const [saving, setSaving] = useState(false)
  const [sourcePending, setSourcePending] = useState(false)
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('veltryn.theme', theme) } catch {} }, [theme])
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
  const [researchSources, setResearchSources] = useState<ResearchSource[]>([])
  const [sourceTitle, setSourceTitle] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceStance, setSourceStance] = useState<ResearchSource['stance']>('supports')
  const [sourceNote, setSourceNote] = useState('')
  const [sourceError, setSourceError] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [shareError, setShareError] = useState('')
  const [rehearsals, setRehearsals] = useState<RehearsalRecord[]>([])
  const [workspaceMode, setWorkspaceMode] = useState<'server' | 'browser'>('browser')
  const [activeRehearsalId, setActiveRehearsalId] = useState<string | undefined>()
  const [saved, setSaved] = useState(false)
  const [showMethod, setShowMethod] = useState(false)
  const snapshotLocked = useRef(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => { loadRehearsalsWithFallback().then(({ records, mode }) => { setRehearsals(records); setWorkspaceMode(mode) }) }, [])

  useEffect(() => {
    if (snapshotLocked.current) return
    setTicker(null); setCandles([]); setProviderState('loading')
    let cancelled = false
    Promise.all([listRwaInstruments(), getTicker(selected), getCandles(selected)])
      .then(([items, live, history]) => { if (!cancelled && !snapshotLocked.current) { const supported = items.filter((item) => supportedSymbols.includes(item.symbol)); setInstruments(supported.length ? supported : fallbackInstruments); setTicker(live.ticker); setCandles(history.candles); setProviderState('live') } })
      .catch(() => { if (!cancelled && !snapshotLocked.current) setProviderState('fallback') })
    return () => { cancelled = true }
  }, [selected, refreshKey])

  const liveEntry = ticker ? Number(ticker.lastPr) : 232.5
  const plan = useMemo<PositionPlan>(() => ({ direction, entryPrice: liveEntry, quantity, collateral, lossBudget, feeRate: 0.0006, fundingRate: ticker ? Number(ticker.fundingRate) : 0, fundingPeriods: 3 }), [direction, liveEntry, quantity, collateral, lossBudget, ticker])
  const calm = makePath(liveEntry, direction, endpointMove, endpointMove * 0.25)
  const shock = makePath(liveEntry, direction, endpointMove, dipMove)
  const calmResult = stressPath(plan, calm)
  const shockResult = stressPath(plan, shock)
  const leverage = liveEntry * quantity / collateral
  const historicalReturn = candles.length > 1 ? (Number(candles[candles.length - 1][4]) / Number(candles[0][1])) - 1 : null

  const updateNumber = (setter: (v: number) => void) => (event: React.ChangeEvent<HTMLInputElement>) => { const value = Number(event.target.value); if (Number.isFinite(value) && value > 0) setter(value) }
  const reportStatus = (result: StressResult) => result.status === 'within-budget' ? 'Within budget' : result.status === 'stop-triggered' ? 'Stop triggered' : 'Budget breached'
  const saveCurrent = () => {
    if (saving) return
    setSaving(true)
    persistRehearsalWithFallback({ symbol: selected, direction, quantity, collateral, lossBudget, endpointMove, dipMove, thesis, providerState: ticker ? 'live' : 'fallback', ticker, candles, researchSources }, activeRehearsalId).then(({ record, mode }) => { setRehearsals((current) => [record, ...current.filter((item) => item.id !== record.id)]); setWorkspaceMode(mode); setActiveRehearsalId(record.id); setSaved(true) }).catch(() => setShareError('Could not save. Please try again.')).finally(() => setSaving(false))
  }
  const openRehearsal = (record: RehearsalRecord) => {
    snapshotLocked.current = true
    setShareUrl(''); setShareError(''); setSaved(false); setActiveRehearsalId(record.id); setSelected(record.symbol); setDirection(record.direction); setQuantity(record.quantity); setCollateral(record.collateral); setLossBudget(record.lossBudget); setEndpointMove(record.endpointMove); setDipMove(record.dipMove); setThesis(record.thesis); setResearchSources(record.researchSources ?? []); setTicker(record.ticker); setCandles(record.candles); setProviderState(record.providerState); setTab('rehearse')
  }
  const addSource = async () => {
    if (sourcePending) return
    setSourcePending(true)
    try {
      const parsed = new URL(sourceUrl.trim())
      if (parsed.protocol !== 'https:') throw new Error('Use an HTTPS source URL.')
      if (!sourceTitle.trim() || !sourceNote.trim()) throw new Error('Add a title and a short note.')
      if (researchSources.length >= 6) throw new Error('A rehearsal can hold up to six sources.')
      const verified = await verifyRemoteSource(parsed.toString())
      setResearchSources((current) => [...current, { ...verified.source, title: sourceTitle.trim(), url: parsed.toString(), stance: sourceStance, note: sourceNote.trim() }])
      setSourceTitle(''); setSourceUrl(''); setSourceNote(''); setSourceError('')
    } catch (error) { setSourceError(error instanceof Error ? error.message : 'Source could not be added.') } finally { setSourcePending(false) }
  }
  const shareReport = async () => {
    if (!activeRehearsalId || workspaceMode !== 'server') { setShareError('Save this rehearsal through the workspace API before sharing.'); return }
    try { const result = await createRemoteShare(activeRehearsalId); const full = `${window.location.origin}${result.url}`; setShareUrl(full); await navigator.clipboard?.writeText(full) } catch { setShareError('Could not create a public report link.') }
  }
  const revokeReport = async () => { if (!activeRehearsalId) return; try { await revokeRemoteShare(activeRehearsalId); setShareUrl(''); setShareError('Public report link revoked.') } catch { setShareError('Could not revoke the public report link.') } }
  const downloadReport = (format: 'json' | 'csv' | 'pdf') => {
    if (format === 'pdf') { window.print(); return }
    if (workspaceMode === 'server' && activeRehearsalId) { const link = document.createElement('a'); link.href = `/api/workspace/rehearsals/${encodeURIComponent(activeRehearsalId)}/export?format=${format}`; link.click(); return }
    const payload = { symbol: selected, direction, quantity, collateral, lossBudget, endpointMove, dipMove, thesis, researchSources, calm: calmResult, shock: shockResult, exportedAt: new Date().toISOString(), mode: 'browser-fallback' }
    const content = format === 'json' ? JSON.stringify(payload, null, 2) : ['field,value', ...Object.entries(payload).filter(([key]) => typeof valueToText(payload[key as keyof typeof payload]) === 'string').map(([key, value]) => `"${key}","${valueToText(value).replaceAll('"', '""')}"`)].join('\n')
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `veltryn-${selected}.${format}`; link.click(); URL.revokeObjectURL(link.href)
  }

  if (window.location.pathname.startsWith('/report/')) return <PublicReport token={window.location.pathname.split('/').at(-1) ?? ''} />

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Veltryn home"><img className="brand-logo" src="/veltryn.svg" alt="" width="34" height="34" /><span>veltryn</span></a>
      <nav className="main-nav" aria-label="Primary navigation">
        <button className={tab === 'rehearse' ? 'active' : ''} onClick={() => setTab('rehearse')}>Rehearse</button>
        <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>Library</button>
        <button className={tab === 'methodology' ? 'active' : ''} onClick={() => setTab('methodology')}>Methodology</button>
      </nav>
      <div className="top-actions"><span className={`live-chip ${providerState}`}><span className="status-dot" />{providerState === 'live' ? (snapshotLocked.current ? 'Saved market snapshot' : 'Bitget live data') : providerState === 'fallback' ? 'Recorded example' : providerState === 'error' ? 'Data unavailable' : 'Connecting'}</span><button className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☼' : '☾'}</button><button className="icon-button" aria-label="Help" onClick={() => setTab('methodology')}><CircleHelp size={18} /></button></div>
    </header>
    <main id="top">
      {tab === 'rehearse' && <>
        <section className="hero-row"><div><h1>Rehearse the trade.</h1><p className="hero-copy">Your thesis has a destination. Find out what happens along the way.</p></div><div className="hero-note"><ShieldCheck size={18} /><div><strong>Read-only by design</strong><span>Veltryn researches and models. You decide.</span></div></div></section>
        <section className="workspace-grid">
          <aside className="plan-panel panel"><div className="panel-heading"><div><span className="step-label">01 / POSITION</span><h2>State the trade</h2></div><button className="text-button" onClick={() => { snapshotLocked.current = false; setActiveRehearsalId(undefined); setQuantity(0.1); setCollateral(1000); setLossBudget(180); setDirection('long'); setEndpointMove(0.06); setDipMove(0.09); setResearchSources([]); setShareUrl(''); setShareError(''); setSaved(false); setRefreshKey(k => k + 1) }}><RotateCcw size={14} /> Reset</button></div>
            <InstrumentPicker value={selected} items={instruments} onChange={(symbol) => { snapshotLocked.current = false; setActiveRehearsalId(undefined); setSelected(symbol); setShareUrl(''); setShareError(''); setSaved(false) }} />
            <div className="segmented" aria-label="Direction"><button className={direction === 'long' ? 'selected long' : ''} aria-pressed={direction === 'long'} onClick={() => setDirection('long')}><ArrowUpRight size={16} /> Long</button><button className={direction === 'short' ? 'selected short' : ''} aria-pressed={direction === 'short'} onClick={() => setDirection('short')}><ArrowDownRight size={16} /> Short</button></div>
            <div className="field-grid"><label>Quantity<input type="number" min="0.01" step="0.01" value={quantity} onChange={updateNumber(setQuantity)} /></label><label>Collateral<div className="input-wrap"><input type="number" min="1" step="10" value={collateral} onChange={updateNumber(setCollateral)} /><span className="input-suffix">USDT</span></div></label></div>
            <div className="field-grid"><label>Loss budget<div className="input-wrap"><input type="number" min="1" step="10" value={lossBudget} onChange={updateNumber(setLossBudget)} /><span className="input-suffix">USDT</span></div></label><label>Thesis endpoint<div className="input-wrap"><input type="number" min="1" max="50" step="1" value={Number((endpointMove * 100).toFixed(2))} onChange={(event) => { const v = Number(event.target.value); if (v > 0 && v <= 50) setEndpointMove(v / 100) }} /><span className="input-suffix">%</span></div></label></div>
            <label className="thesis-label">Your thesis<textarea value={thesis} onChange={(event) => setThesis(event.target.value)} /></label>
            <details className="research-box"><summary>Research & evidence <span>{researchSources.length}/6 sources</span></summary><div className="research-heading"><div><span className="evidence-label">03 / RESEARCH CONTEXT</span><strong>Attach what you know.</strong></div><span>{researchSources.length}/6</span></div><p>Link supporting, counter, or contextual evidence. Veltryn stores references; it does not silently endorse them.</p><div className="source-form"><input aria-label="Source title" placeholder="Source title" value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} /><input aria-label="Source URL" placeholder="https://..." value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /><div className="source-form-row"><select aria-label="Evidence stance" value={sourceStance} onChange={(event) => setSourceStance(event.target.value as ResearchSource['stance'])}><option value="supports">Supports thesis</option><option value="counters">Counters thesis</option><option value="context">Context only</option></select><input aria-label="Source note" placeholder="What does it establish?" value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} /><button className="outline-button" onClick={addSource} disabled={sourcePending || researchSources.length >= 6}>{sourcePending ? 'Verifying…' : 'Add'}</button></div></div>{sourceError && <small className="source-error">{sourceError}</small>}{researchSources.length > 0 && <div className="source-list">{researchSources.map((source) => <div className="source-row" key={source.id}><div><strong>{source.title}</strong><span>{source.note}</span><a href={source.url} target="_blank" rel="noreferrer">{source.url}</a></div><button className="icon-button" aria-label={`Remove ${source.title}`} onClick={() => setResearchSources((current) => current.filter((item) => item.id !== source.id))}><X size={15} /></button></div>)}</div>}</details>
            <label className="shock-control">Adverse move <strong>{pct(dipMove)}</strong><input aria-label="Adverse move" type="range" min="1" max="40" value={dipMove * 100} onChange={e => setDipMove(Number(e.target.value)/100)} /><small>How far could price move against you?</small></label><div className="plan-foot"><span>Estimated leverage <strong>{leverage.toFixed(2)}×</strong></span><span>Entry <strong>{money(liveEntry)}</strong></span></div>
            <button className="primary-button" onClick={() => document.querySelector('.result-header')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })}><Sparkles size={16} /> Review live results <span>↗</span></button>
          </aside>
          <section className="results-column" aria-label="Scenario results"><div className="market-strip panel"><div className="market-id"><AssetLogo symbol={selected} /><div><strong>{selected.replace('USDT', '')} / USDT</strong><span>Bitget stock perpetual · {providerState === 'live' ? (snapshotLocked.current ? 'saved snapshot' : 'observed now') : 'illustrative snapshot'}</span></div></div><div className="market-stat"><span>Mark price</span><strong>{money(ticker ? Number(ticker.markPrice) : liveEntry)}</strong></div><div className="market-stat"><span>Funding / 8h</span><strong className={Number(ticker?.fundingRate ?? 0) > 0 ? 'warning-text' : ''}>{ticker ? pct(Number(ticker.fundingRate)) : '0.00%'}</strong></div><div className="market-stat"><span>Data captured</span><strong>{ticker ? new Date(Number(ticker.ts)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Example'}</strong></div></div>
            <div className="result-header"><div><span className="step-label">02 / PATH TEST</span><h2>Two paths. One thesis.</h2><p>Both scenarios finish at your {pct(endpointMove)} thesis endpoint. The dashed path tests the shock you must survive first.</p></div><div className="result-actions"><button className="outline-button save-action" disabled={saving} onClick={saveCurrent}><Copy size={15} /> {saving ? 'Saving…' : activeRehearsalId ? 'Save revision' : 'Save rehearsal'}</button><details className="export-menu"><summary>Export ↗</summary><div><button className="icon-button" aria-label="Export JSON" onClick={() => downloadReport('json')}>JSON</button><button className="icon-button" aria-label="Export CSV" onClick={() => downloadReport('csv')}>CSV</button><button className="icon-button" aria-label="Print or save PDF" onClick={() => downloadReport('pdf')}>PDF</button></div></details><button className="icon-button" aria-label="Share public report" disabled={!activeRehearsalId || workspaceMode !== 'server'} title={!activeRehearsalId ? 'Save your rehearsal before sharing' : 'Create public report'} onClick={shareReport}>Share</button></div></div>
            {(shareUrl || shareError) && <div className="share-note">{shareUrl ? <>Public report ready: <a href={shareUrl} target="_blank" rel="noreferrer">{shareUrl}</a> <button className="text-button" onClick={revokeReport}>Revoke</button></> : shareError}</div>}
            <div className="chart-card panel"><div className="chart-meta"><div className="legend"><span><i className="legend-line calm" />Calm path</span><span><i className="legend-line shock" />Shock → recovery</span></div><span className="chart-tag">MODELED PATHS</span></div><PriceChart candles={candles} calm={calm.map((p) => p.price)} shock={shock.map((p) => p.price)} /></div>
            <div className="outcome-grid"><OutcomeCard label="Calm path" result={calmResult} color="teal" /><OutcomeCard label="Shock → recovery" result={shockResult} color="amber" /></div>
            <div className="evidence-card panel"><div className="evidence-heading"><div className="source-icon"><Database size={16} /></div><div><strong>What the model used</strong><span>Evidence is separated from the scenario assumptions.</span></div><button className="text-button" onClick={() => setTab('methodology')}>View method <ArrowUpRight size={14} /></button></div><div className="evidence-grid"><div><span className="evidence-label">Observed from Bitget</span><strong>{ticker ? 'Mark, index, ticker and funding' : 'Example snapshot only'}</strong><small>{ticker ? (snapshotLocked.current ? 'Market snapshot from saved rehearsal' : 'Live public market endpoint · captured now') : 'Provider unavailable for this session'}</small></div><div><span className="evidence-label">Modeled assumption</span><strong>{pct(dipMove)} adverse dip</strong><small>Deterministic path · not a forecast</small></div><div><span className="evidence-label">Historical context</span><strong>{historicalReturn === null ? 'Insufficient history' : `${pct(historicalReturn)} window move`}</strong><small>{candles.length ? `${candles.length} hourly candles observed` : 'No replay loaded'}</small></div></div></div>
          </section>
        </section>
        {showMethod && <div className="drawer-backdrop" onClick={() => setShowMethod(false)}><aside className="method-drawer" onClick={(event) => event.stopPropagation()}><button className="drawer-close" aria-label="Close method" onClick={() => setShowMethod(false)}><X size={18} /></button><span className="step-label">MODEL NOTE</span><h2>How this rehearsal works</h2><p>Veltryn separates observed Bitget market data from deterministic scenario assumptions. It does not predict the market or place orders.</p><div className="formula"><span>position PnL</span><strong>direction × quantity × (mark − entry)</strong></div><div className="formula"><span>equity</span><strong>collateral + PnL − fees − funding</strong></div><p className="small-copy">This first slice uses a linear isolated position and a taker-fee estimate. Exact liquidation is disabled until maintenance-margin parameters are verified from an authoritative source.</p></aside></div>}
        {saved && <button className="toast" onClick={() => setSaved(false)}><Save size={15} /> {workspaceMode === 'server' ? 'Saved to your workspace' : 'Saved in this browser'}</button>}
      </>}
      {tab === 'library' && <section className="content-page"><span className="step-label">LIBRARY · {workspaceMode === 'server' ? 'ANONYMOUS WORKSPACE' : 'BROWSER FALLBACK'}</span><h1>Your rehearsals.</h1><p>{workspaceMode === 'server' ? 'Pick up where you left off. Each rehearsal keeps your thesis, evidence and captured market prices. Keep this browser session to access your workspace.' : 'You’re offline. Rehearsals are saved in this browser until the workspace reconnects.'}</p>{rehearsals.length === 0 ? <div className="empty-state"><BookOpen size={22} /><strong>No saved rehearsals yet</strong><span>Run a position test from Rehearse and save it to begin.</span><button className="outline-button" onClick={() => setTab('rehearse')}>Start a rehearsal</button></div> : <div className="library-list">{rehearsals.map((record) => <article className="library-row" key={record.id}><button className="library-open" onClick={() => openRehearsal(record)}><div><span className="library-symbol">{record.symbol.replace('USDT', '')} · {record.direction}</span><strong>{record.thesis || 'Untitled rehearsal'}</strong><small>{new Date(record.updatedAt).toLocaleString()} · revision {record.revision} · {record.providerState === 'live' ? 'Bitget snapshot' : 'Recorded example'}</small></div></button><button className="icon-button" aria-label={`Delete ${record.symbol} rehearsal`} onClick={(event) => { event.stopPropagation(); removeRehearsalWithFallback(record.id).then(({ records, mode }) => { setRehearsals(records); setWorkspaceMode(mode); if (activeRehearsalId === record.id) setActiveRehearsalId(undefined) }) }}><Trash2 size={16} /></button></article>)}</div>}</section>}
      {tab === 'methodology' && <section className="content-page"><span className="step-label">METHODOLOGY</span><h1>Make the assumptions visible.</h1><p>Veltryn is a research workbench for human decisions. Every result will show what was observed, what was modeled, and where the evidence is insufficient.</p><div className="method-grid"><div className="method-block"><LineChart size={20} /><h3>Path, not just endpoint</h3><p>A trade can finish at the expected price after violating its loss budget. We render the path and mark the first breach.</p></div><div className="method-block"><Clock3 size={20} /><h3>Funding has a timestamp</h3><p>Funding is applied only at modeled settlement events. Rates held constant for a scenario are labeled assumptions.</p></div><div className="method-block"><AlertTriangle size={20} /><h3>Unknowns stay unknown</h3><p>Missing margin tiers, insufficient depth, and ambiguous candle order produce an explicit limitation instead of invented precision.</p></div></div></section>}
    </main>
    <footer><span>Veltryn · A little perspective before a position</span><span>Read-only research · No orders placed</span></footer>
  </div>
}

function OutcomeCard({ label, result, color }: { label: string; result: StressResult; color: 'teal' | 'amber' }) {
  return <article className={`outcome-card ${color}`}><div className="outcome-top"><span>{label}</span><strong>{reportLabel(result)}</strong></div><div className="outcome-number">{money(result.terminalPnl)}</div><div className="outcome-caption">Terminal modeled PnL</div><div className="outcome-details"><span>Worst drawdown <b>{money(-result.worstDrawdown)}</b></span><span>Loss budget <b>{result.budgetBreachAt ? result.budgetBreachAt : 'Not breached'}</b></span><span>Fees + funding <b>{money(-(result.fees + result.funding))}</b></span></div></article>
}

function reportLabel(result: StressResult) { return result.status === 'within-budget' ? 'WITHIN BUDGET' : result.status === 'stop-triggered' ? 'STOP TRIGGERED' : 'BUDGET BREACHED' }

function PublicReport({ token }: { token: string }) {
  const [state, setState] = useState<{ record: RehearsalRecord; publishedAt: string } | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => { loadPublicReport(token).then(setState).catch(() => setError(true)) }, [token])
  if (error) return <div className="app-shell"><main className="content-page"><span className="step-label">PUBLIC REPORT</span><h1>Report unavailable.</h1><p>This link may have been revoked or no longer exists.</p></main></div>
  if (!state) return <div className="app-shell"><main className="content-page"><span className="step-label">PUBLIC REPORT</span><h1>Loading report.</h1><p>Retrieving the selected revision.</p></main></div>
  const { record } = state
  return <div className="app-shell public-report"><main className="content-page"><span className="step-label">VELTRYN · PUBLIC REPORT</span><h1>Rehearse the trade.</h1><p className="report-meta">{record.symbol.replace('USDT', '')} / USDT perpetual · {record.direction} · revision {record.revision} · published {new Date(state.publishedAt).toLocaleString()}</p><section className="report-sheet panel"><h2>{record.thesis || 'Untitled rehearsal'}</h2><div className="report-grid"><div><span>Quantity</span><strong>{record.quantity}</strong></div><div><span>Collateral</span><strong>{money(record.collateral)}</strong></div><div><span>Loss budget</span><strong>{money(record.lossBudget)}</strong></div><div><span>Thesis endpoint</span><strong>{pct(record.endpointMove)}</strong></div></div><div className="report-section"><span className="evidence-label">RESEARCH CONTEXT</span>{record.researchSources?.length ? record.researchSources.map((source) => <article className="public-source" key={source.id}><strong>{source.title}</strong><span>Claim: {source.note}</span>{source.verification?.excerpt && <small>Verified excerpt: {source.verification.excerpt}</small>}<a href={source.url} rel="noreferrer">{source.url}</a><small>{source.verification?.status === 'verified' ? `Verified capture ${new Date(source.verification.fetchedAt ?? '').toLocaleString()}` : 'Reference not verified by Veltryn'}</small></article>) : <p>No research sources were attached to this revision.</p>}</div><div className="report-section"><span className="evidence-label">LIMITATIONS</span><p>Read-only research artifact. Scenario outputs are modeled, not a forecast. Exact liquidation and arbitrary source retrieval are not claimed.</p></div></section></main></div>
}
