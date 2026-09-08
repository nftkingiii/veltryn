# Deployment evidence

Live demo: https://veltryn-production.up.railway.app/

Verified on 2026-09-08:

- intended source revision: `efa9de0` (`Proxy Bitget market data in production`);
- Railway deployment: `9eee1f92-6488-49cc-845f-5f0957eeedc3`, status `SUCCESS`;
- `GET /healthz` returned `200` with `version: efa9de0` and `readiness: local-store`;
- `GET /` returned `200` and served the built Veltryn shell;
- the production Bitget ticker proxy returned `200` for NVDAUSDT;
- a clean browser loaded live NVDA mark price, funding, and 120 hourly candles, and rendered the calm versus shock→recovery path results;
- a clean production API session created a rehearsal, created a public share, opened the public report with `200`, revoked it, and received `404` afterward.

The Railway service now uses a mounted volume at `/data` with `VELTRYN_DATA_FILE=/data/workspace-data.json`. The JSON store is durable across service restarts for the single deployed replica. It is not a multi-instance database; a managed database remains the production upgrade for horizontal scaling.
