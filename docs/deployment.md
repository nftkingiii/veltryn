# Deployment evidence

Live demo: https://veltryn-production.up.railway.app/

Verified on 2026-09-08:

- intended source revision: `e5eba9a` (`Report mounted volume persistence accurately`);
- Railway deployment: `b4a62bb0-d43a-4dda-bc8f-f193f2a939b6`, status `SUCCESS`;
- `GET /healthz` returned `200` with `version: e5eba9a` and `readiness: volume-store`;
- `GET /` returned `200` and served the built Veltryn shell;
- the production Bitget ticker proxy returned `200` for NVDAUSDT;
- a clean browser loaded live NVDA mark price, funding, and 120 hourly candles, and rendered the calm versus shock→recovery path results;
- a clean production API session created a rehearsal, created a public share, opened the public report with `200`, revoked it, and received `404` afterward.
- a rehearsal created under an anonymous session remained available after a Railway service restart when read back with the same session cookie (`persisted=True`).

The Railway service now uses a mounted volume at `/data` with `VELTRYN_DATA_FILE=/data/workspace-data.json`. The JSON store is durable across service restarts for the single deployed replica. It is not a multi-instance database; a managed database remains the production upgrade for horizontal scaling.
