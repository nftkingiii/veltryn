# Veltryn

Rehearse the trade.

Veltryn is a planned AI research workbench for stress-testing proposed Bitget stock-perpetual positions before a human decides to trade. It connects a stated thesis to market evidence, historical price paths, and explicit position assumptions.

Status: Deployed evaluation milestone. The app has a branded landing page, read-only Bitget market data, deterministic path stress testing, explicit evidence/assumption labeling, SQLite-backed anonymous workspaces, source verification, public reports, exports, and a Library.

The product will compare how funding, liquidity, leverage, and the path of prices affect a proposed position, even when its predicted final direction is correct. Historical observations and hypothetical scenarios will remain distinguishable.

Target: Bitget AI Base Camp Hackathon S2, AI Trading Desk / Decision Stress Testing.

Live demo: https://veltryn-production.up.railway.app/

## Run locally

```powershell
npm install
npm run dev
npm run api
```

Run both commands in separate terminals. The development server proxies public Bitget market requests and the workspace API to avoid browser CORS issues. No account keys, trading permissions, or order placement are used.

## Verified commands

The current workspace passes the equivalent direct checks:

```powershell
node node_modules/typescript/bin/tsc -b --pretty false
node node_modules/vitest/vitest.mjs run
node node_modules/vite/bin/vite.js build
```

The remaining product work is tracked in the private execution plan: a real external AI explanation layer, historical analogue retrieval, authenticated users, and metrics. The current reasoning engine is deterministic and labeled as modeled; it is not presented as a live AI forecast. Browser storage remains a fallback, not multi-device cloud persistence.

### Persistence

The server stores workspace records in SQLite. Local development uses `.private/veltryn.sqlite`; the Railway deployment uses `/data/veltryn.sqlite` on the mounted volume. The first SQLite boot can migrate the previous JSON store from `VELTRYN_DATA_FILE`. This is durable for a single Railway replica and preserves the existing session-scoped ownership and share revocation model. Multi-instance operation should move the same store contract to a managed database.
