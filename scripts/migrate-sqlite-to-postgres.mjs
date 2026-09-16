import { readFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'

const sqliteFile = process.env.VELTRYN_SQLITE_FILE ?? './.private/veltryn.sqlite'
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const sqlite = new DatabaseSync(sqliteFile)
const client = new pg.Client({ connectionString: databaseUrl, ssl: databaseUrl.includes('railway') ? { rejectUnauthorized: false } : undefined })
await client.connect()
try {
  await client.query(await readFile(new URL('../docs/postgres-migration.sql', import.meta.url), 'utf8'))
  await client.query('BEGIN')
  for (const row of sqlite.prepare('SELECT id, created_at FROM sessions').all()) await client.query('INSERT INTO sessions (id, created_at) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [row.id, row.created_at])
  for (const row of sqlite.prepare('SELECT id, session_id, updated_at, data FROM rehearsals').all()) await client.query('INSERT INTO rehearsals (id, session_id, updated_at, data) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (id) DO UPDATE SET updated_at = excluded.updated_at, data = excluded.data', [row.id, row.session_id, row.updated_at, row.data])
  for (const row of sqlite.prepare('SELECT token, rehearsal_id, session_id, created_at, revoked_at FROM shares').all()) await client.query('INSERT INTO shares (token, rehearsal_id, session_id, created_at, revoked_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (token) DO NOTHING', [row.token, row.rehearsal_id, row.session_id, row.created_at, row.revoked_at])
  for (const row of sqlite.prepare('SELECT id, session_id, event_name, created_at, metadata FROM analytics_events').all()) await client.query('INSERT INTO analytics_events (id, session_id, event_name, created_at, metadata) VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT (id) DO NOTHING', [row.id, row.session_id, row.event_name, row.created_at, row.metadata])
  await client.query('COMMIT')
  console.log(JSON.stringify({ status: 'migrated', sessions: sqlite.prepare('SELECT COUNT(*) AS count FROM sessions').get().count, rehearsals: sqlite.prepare('SELECT COUNT(*) AS count FROM rehearsals').get().count, events: sqlite.prepare('SELECT COUNT(*) AS count FROM analytics_events').get().count }))
} catch (error) { await client.query('ROLLBACK'); throw error } finally { await client.end(); sqlite.close() }
