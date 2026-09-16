# Product analytics

Veltryn records a small, anonymous event vocabulary in SQLite: `rehearsal_saved` and `ai_explanation_requested`. Events are tied to the existing anonymous session, contain no credentials or raw research content, and are bounded to a small metadata object.

The session-scoped summary endpoint is `GET /api/analytics/summary`. It reports event count, event types, first/last activity, and counts by event. This supports activation and retention validation without adding accounts.

For PostgreSQL migration, run the target schema and data copy with:

```powershell
$env:DATABASE_URL = "postgresql://..."
node scripts/migrate-sqlite-to-postgres.mjs
```
