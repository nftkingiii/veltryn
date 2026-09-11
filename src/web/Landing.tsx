const candles = [182, 169, 177, 150, 143, 157, 128, 119, 134, 110, 96, 103]

export function Landing() {
  return <div className="landing">
    <a className="landing-skip" href="#landing-content">Skip to content</a>
    <header className="landing-nav">
      <a href="/" className="landing-brand" aria-label="Veltryn home"><img src="/veltryn.svg" alt="" width="36" height="36" />veltryn</a>
      <a className="landing-nav-link" href="/app">Open app <span aria-hidden="true">→</span></a>
    </header>
    <main id="landing-content" className="landing-main">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <h1 id="landing-title">The trade can wait.<br /><em>Rehearse it first.</em></h1>
          <p>Your thesis might be right. The path could still hurt.<br className="landing-desktop-break" /> Explore the risk before you put money on the line.</p>
          <a className="landing-cta" href="/app">Rehearse a trade <span aria-hidden="true">→</span></a>
          <span className="landing-reassurance">No orders placed. Just a clearer perspective.</span>
        </div>
        <div className="landing-art">
          <div className="landing-art-heading"><span>ONE THESIS. TWO PATHS.</span><span>ILLUSTRATIVE REHEARSAL</span></div>
          <div className="landing-instrument"><img src="/instruments/NVDA.png" width="32" height="32" alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} /><div><strong>NVDA <span>/ USDT</span></strong><small>A look beyond the endpoint</small></div><span className="landing-direction">Long →</span></div>
          <svg className="landing-chart" viewBox="0 0 620 330" role="img" aria-labelledby="landing-chart-title landing-chart-desc">
            <title id="landing-chart-title">A calm path and a shock-recovery path</title>
            <desc id="landing-chart-desc">Illustrative candles lead to an entry point. Two modeled paths reach the same endpoint, but the shock-recovery path drops below a loss-budget line first. This is not a forecast.</desc>
            {[65, 125, 185, 245].map(y => <line key={y} x1="20" x2="600" y1={y} y2={y} stroke="#37342f" strokeDasharray="2 6" />)}
            <line x1="272" x2="272" y1="35" y2="280" stroke="#726b61" strokeDasharray="4 5" />
            {candles.map((y, i) => <g key={i} stroke={i % 3 === 2 ? '#cf977e' : '#b5baa5'}><line x1={30+i*20} x2={30+i*20} y1={y-18} y2={y+28} /><rect x={25+i*20} y={y-7} width="10" height="23" rx="1" fill={i % 3 === 2 ? '#cf977e' : '#b5baa5'} /></g>)}
            <line x1="272" x2="600" y1="218" y2="218" stroke="#dd9472" strokeDasharray="5 5" opacity=".7" />
            <text x="590" y="238" textAnchor="end" fill="#d4a58c" fontSize="11">Loss budget</text>
            <path d="M272 107 C320 112 335 81 380 85 S470 57 580 55" fill="none" stroke="#b9c8a5" strokeWidth="3" />
            <path d="M272 107 C315 105 322 259 373 260 S440 139 470 118 S529 56 580 55" fill="none" stroke="#f09b72" strokeWidth="3" />
            <circle cx="272" cy="107" r="5" fill="#f3eee4" /><circle cx="580" cy="55" r="6" fill="#f3eee4" />
            <text x="272" y="310" textAnchor="middle" fill="#aaa398" fontSize="11">ENTRY</text><text x="580" y="310" textAnchor="end" fill="#aaa398" fontSize="11">SAME ENDPOINT</text>
          </svg>
          <div className="landing-chart-legend"><span><i />Calm path</span><span><i />Shock & recovery</span><small>Modeled, not predicted</small></div>
          <div className="landing-art-note"><span aria-hidden="true">↳</span> Being right at the finish isn't the whole story.</div>
        </div>
      </section>
      <section className="landing-bottom" aria-label="How Veltryn works"><p>A little preparation.<br /><strong>A more considered trade.</strong></p><ol><li><span>01</span>Set your thesis</li><li><span>02</span>Stress the journey</li><li><span>03</span>Keep your evidence</li></ol></section>
    </main>
    <footer className="landing-footer"><span>Veltryn · Before the trade.</span><span>Read-only rehearsal. Not financial advice.</span></footer>
  </div>
}
