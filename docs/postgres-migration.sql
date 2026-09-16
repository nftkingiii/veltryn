-- Veltryn PostgreSQL target schema. SQLite remains the safe default until DATABASE_URL
-- is provisioned and a dual-read cutover is verified in staging.
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS rehearsals (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), updated_at TIMESTAMPTZ NOT NULL, data JSONB NOT NULL);
CREATE INDEX IF NOT EXISTS rehearsals_session_updated ON rehearsals(session_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS shares (token TEXT PRIMARY KEY, rehearsal_id TEXT NOT NULL REFERENCES rehearsals(id), session_id TEXT NOT NULL REFERENCES sessions(id), created_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS analytics_events (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), event_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, metadata JSONB NOT NULL);
CREATE INDEX IF NOT EXISTS analytics_events_session_created ON analytics_events(session_id, created_at DESC);
