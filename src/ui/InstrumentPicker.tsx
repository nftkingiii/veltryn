import { useEffect, useRef, useState } from 'react'
import { instrumentBrands } from '../domain/instruments'
import type { Instrument } from '../providers/bitget'

export function AssetLogo({symbol}: {symbol:string}) {
  const [failedSymbol,setFailedSymbol] = useState('')
  const brand = instrumentBrands.find(item=>item.symbol===symbol)
  return <span className="instrument-logo">{brand && failedSymbol!==symbol ? <img width="28" height="28" src={`/instruments/${brand.ticker}.png`} alt={`${brand.name} logo`} onError={()=>setFailedSymbol(symbol)}/> : <span>{symbol.replace('USDT','').slice(0,2)}</span>}</span>
}

export function InstrumentPicker({value,items,onChange}: {value:string;items:Instrument[];onChange:(symbol:string)=>void}) {
  const [open,setOpen] = useState(false)
  const [query,setQuery] = useState('')
  const [active,setActive] = useState(0)
  const root=useRef<HTMLDivElement>(null), input=useRef<HTMLInputElement>(null), trigger=useRef<HTMLButtonElement>(null)
  const selected=instrumentBrands.find(item=>item.symbol===value)
  const available=new Set(items.map(item=>item.symbol))
  const filtered=instrumentBrands.filter(item=>available.has(item.symbol) && `${item.name} ${item.ticker}`.toLowerCase().includes(query.toLowerCase().trim()))
  const close=()=>{setOpen(false);trigger.current?.focus()}
  const choose=(symbol:string)=>{onChange(symbol);close()}
  useEffect(()=>{if(open){setQuery('');setActive(0);input.current?.focus()}},[open])
  useEffect(()=>{const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[])
  useEffect(()=>{root.current?.querySelector(`#instrument-option-${active}`)?.scrollIntoView({block:'nearest'})},[active])
  return <div className="instrument-picker" ref={root} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();close()}}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false)}}>
    <span className="picker-label" id="instrument-label">Instrument</span>
    <button ref={trigger} type="button" className="instrument-trigger" aria-label={`Choose instrument: ${selected?.name ?? value}`} aria-expanded={open} aria-haspopup="listbox" aria-controls="instrument-options" onClick={()=>setOpen(!open)}><AssetLogo symbol={value}/><span className="instrument-title"><strong>{selected?.ticker ?? value}</strong><small>{selected?.name ?? 'Saved instrument'}</small></span><span className="instrument-pair">USDT</span><span aria-hidden="true">⌄</span></button>
    {open && <div className="instrument-popover"><div className="instrument-search"><span aria-hidden="true">⌕</span><input ref={input} role="combobox" aria-label="Search instruments" aria-autocomplete="list" aria-expanded="true" aria-controls="instrument-options" aria-activedescendant={filtered.length?`instrument-option-${active}`:undefined} placeholder="Search company or ticker…" value={query} onChange={e=>{setQuery(e.target.value);setActive(0)}} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(0,Math.min(filtered.length-1,i+(e.key==='ArrowDown'?1:-1))))}if(e.key==='Enter'&&filtered[active]){e.preventDefault();choose(filtered[active].symbol)}}}/></div><div className="picker-meta"><span>STOCK PERPETUALS</span><span>{filtered.length} instruments</span></div><div id="instrument-options" role="listbox" aria-labelledby="instrument-label" className="instrument-options">{filtered.map((item,index)=><button type="button" role="option" aria-selected={value===item.symbol} id={`instrument-option-${index}`} key={item.symbol} tabIndex={-1} className={`instrument-option ${index===active?'highlighted':''}`} onMouseEnter={()=>setActive(index)} onClick={()=>choose(item.symbol)}><AssetLogo symbol={item.symbol}/><span className="instrument-title"><strong>{item.ticker}</strong><small>{item.name}</small></span><span className="instrument-pair">USDT</span><span className="instrument-check" aria-hidden="true">{value===item.symbol?'✓':''}</span></button>)}</div>{!filtered.length&&<div className="picker-empty">No instruments match “{query}”.<button type="button" onClick={()=>{setQuery('');input.current?.focus()}}>Clear search</button></div>}<div className="picker-hint">↑ ↓ navigate <span>↵ select · esc close</span></div></div>}
  </div>
}
