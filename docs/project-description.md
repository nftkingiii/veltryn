# Veltryn — project description

## Part 1 · Thesis

Veltryn is built around one hypothesis: traders need to know whether a position can survive the path required to reach its target, not only what its terminal profit or loss might be.

The product turns a trader's thesis into a deterministic rehearsal using observed Bitget market data and explicit assumptions. It models a calm path and a shock-to-recovery path, then calculates PnL, fees, funding, worst drawdown, loss-budget breaches, terminal equity, and Bitget's authenticated liquidation price. Historical analogue retrieval compares the latest completed candle shape with earlier completed windows while excluding the future from feature selection.

Anthropic is used as an explanation layer. Claude summarizes the supplied evidence, separates observed facts from modeled assumptions, highlights risks, and raises open questions. It does not calculate authoritative financial values, forecast prices, place orders, or mutate the rehearsal.

## Part 2 · Target user and product value

The target user is a retail or emerging-pro trader with moderate risk appetite, approximately $500–$10,000 in capital, trading crypto or tokenized-equity perpetuals several times per week. The core use case is testing a directional catalyst thesis before committing capital.

Existing charting and trading tools emphasize signals, leverage, and target prices, but rarely show whether a position survives an adverse move before the thesis plays out. Veltryn makes that path risk visible, connects it to a loss budget, grounds the review in Bitget data and user-provided research, and explains the result in plain language.

## Part 3 · Validation data and key metrics

Observed:

- The deterministic engine and product tests pass: 4 tests across 2 test files.
- TypeScript compilation and the production build pass.
- Railway is healthy on a persistent SQLite volume.
- Bitget public market data is integrated for contracts, tickers, candles, and funding history.
- Bitget's signed liquidation-price request is live in Demo mode using `paptrading: 1` and read-only credentials.
- Anthropic's live explanation endpoint returned HTTP 200 with structured summary, risks, evidence, and questions.
- Anonymous analytics event capture and session-scoped summaries are live.

Not claimed:

- No live trading-strategy return, Sharpe, Sortino, win rate, turnover, slippage, or AUM figures are claimed. Veltryn is a non-custodial rehearsal tool, not an execution strategy.

Targeted next validation:

- 10–20 moderated test users.
- 70% completion from instrument selection to saved rehearsal.
- 50% of activated users creating at least two rehearsals.
- Median AI explanation response below 20 seconds.
- 60% of users identifying a previously overlooked risk or changing an assumption.

Distribution will be measured through activation (first saved rehearsal), rehearsal revisions, analogue views, AI explanation requests, report shares, and seven-day return activity. No user funds are held and no trading or withdrawal action is available.

## Part 4 · Progress

Built:

- Branded landing page and rehearsal workspace.
- Bitget instrument selector, official logos, live ticker/candles/funding data, and candlestick chart.
- Calm-path and shock-recovery overlays.
- Deterministic risk engine with loss-budget and drawdown analysis.
- Authenticated Bitget liquidation-price retrieval with Demo-mode support.
- Historical analogue matching from completed candle windows with no-look-ahead selection.
- Research-source capture and HTTPS verification.
- SQLite persistence, revisions, exports, shareable reports, and anonymous sessions.
- Anthropic explanation endpoint with server-only key handling, validation, timeout, and rate limits.
- Anonymous analytics events and session summaries.
- PostgreSQL target schema and repeatable SQLite-to-PostgreSQL migration utility.

The verified production backend remains SQLite on Railway. Runtime PostgreSQL cutover and staging migration verification are the next infrastructure step; the migration tool is prepared but PostgreSQL is not being presented as the active production database.

The main development issues were separating AI commentary from authoritative calculations, handling public-provider fallback, avoiding look-ahead in historical comparisons, and refusing to approximate liquidation when Bitget data was available through its authenticated endpoint.

## Part 5 · Take on AI Trading

AI Trading should move beyond confident buy/sell signals. Its strongest role is making assumptions explicit, comparing possible paths, identifying missing evidence, and explaining fragility.

Veltryn uses AI as an interpretable reasoning layer around a deterministic risk engine. This creates a clearer boundary between observed data, scenario assumptions, computed financial outcomes, and generated commentary. The future of Agentic Trading should combine evidence grounding, adverse-state testing, transparent reasoning receipts, user-controlled permissions, and explicit approval before any execution.
