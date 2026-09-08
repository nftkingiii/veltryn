# Veltryn

Rehearse the trade.

Veltryn is a planned AI research workbench for stress-testing proposed Bitget stock-perpetual positions before a human decides to trade. It connects a stated thesis to market evidence, historical price paths, and explicit position assumptions.

Status: M2 browser-persistent rehearsal slice. The local app has a read-only Bitget market adapter, deterministic path stress test, explicit evidence/assumption labeling, and a Library that persists captured rehearsals in the browser.

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

The remaining product work is tracked in the private execution plan: server-backed anonymous workspaces, research retrieval, AI explanation, deployment, and evidence capture. Browser storage is deliberately not presented as multi-device or cloud persistence.

### Persistence

The server stores workspace records in SQLite. Local development uses `.private/veltryn.sqlite`; the Railway deployment uses `/data/veltryn.sqlite` on the mounted volume. The first SQLite boot can migrate the previous JSON store from `VELTRYN_DATA_FILE`. This is durable for a single Railway replica and preserves the existing session-scoped ownership and share revocation model. Multi-instance operation should move the same store contract to a managed database.
