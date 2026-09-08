# Deployment evidence

Live demo: https://veltryn-production.up.railway.app/

Verified on 2026-09-08:

- intended source revision: `847d484` (`Support SQLite migration on Node 22`);
- Railway deployment: `1a4993a0-32e1-493b-8c38-129abd70d077`, status `SUCCESS`;
- `GET /healthz` returned `200` with `version: e5eba9a` and `readiness: sqlite-volume`;
- `GET /` returned `200` and served the built Veltryn shell;
- the production Bitget ticker proxy returned `200` for NVDAUSDT;
- a clean browser loaded live NVDA mark price, funding, and 120 hourly candles, and rendered the calm versus shock→recovery path results;
- a clean production API session created a rehearsal, created a public share, opened the public report with `200`, revoked it, and received `404` afterward.
- a rehearsal created under an anonymous session remained available after a Railway service restart when read back with the same session cookie (`persisted=True`).
- the previous JSON-backed rehearsal was migrated into SQLite, then a live share opened with `200` and returned `404` after revocation.

The Railway service now uses a mounted volume at `/data` with `VELTRYN_SQLITE_FILE=/data/veltryn.sqlite`. On first boot, SQLite migrates the previous `/data/workspace-data.json` store if present. The SQLite database is durable across service restarts for the single deployed replica. It is not a multi-instance database; a managed database remains the production upgrade for horizontal scaling.
