import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import { stat, readFile as readFileBinary } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sqliteFile = resolve(process.env.VELTRYN_SQLITE_FILE ?? `${root}/.private/veltryn.sqlite`)
const legacyDataFile = resolve(process.env.VELTRYN_DATA_FILE ?? `${root}/.private/workspace-data.json`)
const port = Number(process.env.PORT ?? 8787)
const host = process.env.HOST ?? '0.0.0.0'
const maxBody = 64 * 1024
const maxRecords = 50
const version = process.env.VELTRYN_VERSION ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? 'dev'
const persistenceMode = sqliteFile.startsWith('/data/') ? 'sqlite-volume' : 'sqlite-local'
const anthropicModel = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim()
const bitgetKey = process.env.BITGET_API_KEY?.trim()
const bitgetSecret = process.env.BITGET_API_SECRET?.trim()
const bitgetPassphrase = process.env.BITGET_API_PASSPHRASE?.trim()
const bitgetDemo = process.env.BITGET_DEMO === 'true'
const aiRequests = new Map()
await mkdir(dirname(sqliteFile), { recursive: true })
const database = new DatabaseSync(sqliteFile)
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS rehearsals (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS rehearsals_session_updated ON rehearsals(session_id, updated_at DESC);
  CREATE TABLE IF NOT EXISTS shares (token TEXT PRIMARY KEY, rehearsal_id TEXT NOT NULL, session_id TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT);
  CREATE TABLE IF NOT EXISTS analytics_events (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, event_name TEXT NOT NULL, created_at TEXT NOT NULL, metadata TEXT NOT NULL);
  `)

function parseJson(value) { return JSON.parse(value) }
function legacyStore() {
  try { return JSON.parse(readFileSync(legacyDataFile, 'utf8')) } catch { return null }
}
if (sqliteFile !== legacyDataFile && database.prepare('SELECT COUNT(*) AS count FROM sessions').get().count === 0) {
  const legacy = legacyStore()
  if (legacy) {
    database.exec('BEGIN')
    try {
      const sessionInsert = database.prepare('INSERT OR IGNORE INTO sessions (id, created_at) VALUES (?, ?)')
      for (const item of Object.values(legacy.sessions ?? {})) sessionInsert.run(item.id, item.createdAt)
      const rehearsalInsert = database.prepare('INSERT OR IGNORE INTO rehearsals (id, session_id, updated_at, data) VALUES (?, ?, ?, ?)')
      for (const item of Object.values(legacy.rehearsals ?? {})) rehearsalInsert.run(item.id, item.sessionId, item.updatedAt, JSON.stringify(item))
      const shareInsert = database.prepare('INSERT OR IGNORE INTO shares (token, rehearsal_id, session_id, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)')
      for (const [token, item] of Object.entries(legacy.shares ?? {})) shareInsert.run(token, item.rehearsalId, item.sessionId, item.createdAt, item.revokedAt ?? null)
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  }
}

function digest(value) { return createHash('sha256').update(value).digest('hex') }
function cookieValue(request) { return request.headers.cookie?.match(/(?:^|; )veltryn_session=([^;]+)/)?.[1] }
function session(request, response) {
  const raw = cookieValue(request)
  const key = raw && digest(raw)
  if (key) {
    const existing = database.prepare('SELECT id, created_at AS createdAt FROM sessions WHERE id = ?').get(key)
    if (existing) return existing
  }
  const token = randomBytes(32).toString('base64url')
  const sessionId = digest(token)
  const createdAt = new Date().toISOString()
  database.prepare('INSERT INTO sessions (id, created_at) VALUES (?, ?)').run(sessionId, createdAt)
  response.setHeader('Set-Cookie', `veltryn_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`)
  return { id: sessionId, createdAt }
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin' })
  response.end(JSON.stringify(body))
}

function aiQuota(sessionId) {
  const now = Date.now(); const windowMs = 10 * 60 * 1000
  const recent = (aiRequests.get(sessionId) ?? []).filter((at) => now - at < windowMs)
  if (recent.length >= 5) return false
  recent.push(now); aiRequests.set(sessionId, recent); return true
}

function aiInput(value) {
  if (!value || typeof value !== 'object' || typeof value.thesis !== 'string' || value.thesis.length > 2000) return false
  if (!['long', 'short'].includes(value.direction) || typeof value.symbol !== 'string' || !/^[A-Z0-9]{3,20}USDT$/.test(value.symbol)) return false
  if (!value.scenarios || typeof value.scenarios !== 'object' || !Array.isArray(value.sources) || value.sources.length > 6) return false
  return JSON.stringify(value).length <= 24_000
}

function parseAiText(payload) {
  const text = payload?.content?.find((item) => item.type === 'text')?.text?.trim()
  if (!text) throw new Error('empty_ai_response')
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const parsed = JSON.parse(clean)
  if (typeof parsed.summary !== 'string' || !Array.isArray(parsed.risks) || !Array.isArray(parsed.evidence) || !Array.isArray(parsed.questions)) throw new Error('invalid_ai_response')
  return { summary: parsed.summary.slice(0, 1200), risks: parsed.risks.filter((item) => typeof item === 'string').slice(0, 4).map((item) => item.slice(0, 300)), evidence: parsed.evidence.filter((item) => typeof item === 'string').slice(0, 4).map((item) => item.slice(0, 300)), questions: parsed.questions.filter((item) => typeof item === 'string').slice(0, 4).map((item) => item.slice(0, 300)) }
}

async function explainWithAnthropic(input) {
  if (!anthropicKey) return { status: 'unavailable', provider: 'none', reason: 'AI_PROVIDER_NOT_CONFIGURED' }
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const result = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: anthropicModel, max_tokens: 700, system: 'You are Veltryn\'s risk-explanation layer. Explain only the supplied deterministic rehearsal and observed evidence. Do not forecast, invent facts or citations, recompute authoritative numbers, give financial advice, or suggest execution. Return JSON only with string fields summary and arrays risks, evidence, questions.', messages: [{ role: 'user', content: `Explain this rehearsal using only this JSON. Preserve the distinction between observed market data and modeled paths. Cite source IDs only when present.\n${JSON.stringify(input)}` }] }) })
    if (!result.ok) throw new Error('anthropic_unavailable')
    return { status: 'ready', provider: 'anthropic', model: anthropicModel, explanation: parseAiText(await result.json()) }
  } finally { clearTimeout(timer) }
}

async function staticFile(request, response) {
  if (request.method !== 'GET') return false
  const url = new URL(request.url ?? '/', 'http://localhost')
  if (url.pathname.startsWith('/api/') || url.pathname === '/healthz') return false
  const documentRoute = ['/', '/app', '/app/'].includes(url.pathname) || /^\/report\/[^/]+$/.test(url.pathname)
  const requested = documentRoute ? '/index.html' : url.pathname
  const distRoot = resolve(root, 'dist')
  const file = resolve(distRoot, `.${requested}`)
  if (!file.startsWith(distRoot)) return false
  try {
    const info = await stat(file)
    if (!info.isFile()) return false
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' }
    response.writeHead(200, { 'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream', 'cache-control': file.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin' })
    response.end(await readFileBinary(file)); return true
  } catch { return false }
}

async function proxyBitget(request, response) {
  if (request.method !== 'GET' || !request.url?.startsWith('/api/bitget/api/v2/mix/market/')) return false
  const upstream = new URL(request.url.replace('/api/bitget', ''), 'https://api.bitget.com')
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const result = await fetch(upstream, { signal: controller.signal, headers: { accept: 'application/json' } })
    const text = await result.text()
    response.writeHead(result.status, { 'content-type': result.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
    response.end(text); return true
  } catch {
    send(response, 502, { error: 'bitget_unavailable' }); return true
  } finally { clearTimeout(timer) }
}

async function signedBitgetGet(path, params) {
  if (!bitgetKey || !bitgetSecret || !bitgetPassphrase) return { status: 'unavailable', reason: 'BITGET_PRIVATE_API_NOT_CONFIGURED' }
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString()
  const timestamp = String(Date.now())
  const requestPath = `${path}?${query}`
  const signature = createHmac('sha256', bitgetSecret).update(`${timestamp}GET${requestPath}`).digest('base64')
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const result = await fetch(`https://api.bitget.com${requestPath}`, { signal: controller.signal, headers: { 'ACCESS-KEY': bitgetKey, 'ACCESS-SIGN': signature, 'ACCESS-TIMESTAMP': timestamp, 'ACCESS-PASSPHRASE': bitgetPassphrase, 'locale': 'en-US', ...(bitgetDemo ? { paptrading: '1' } : {}), accept: 'application/json' } })
    const payload = await result.json()
    if (!result.ok || payload.code !== '00000') return { status: 'error', reason: 'BITGET_PRIVATE_API_REJECTED', code: String(payload.code ?? 'unknown').slice(0, 32) }
    return { status: 'ready', liqPrice: Number(payload.data?.liqPrice), observedAt: new Date().toISOString() }
  } finally { clearTimeout(timer) }
}

function validLiqInput(value) {
  return value && typeof value.symbol === 'string' && /^[A-Z0-9]{3,20}USDT$/.test(value.symbol) && ['long', 'short'].includes(value.direction) && Number.isFinite(Number(value.openAmount)) && Number(value.openAmount) > 0 && Number.isFinite(Number(value.openPrice)) && Number(value.openPrice) > 0
}

async function body(request) {
  let text = ''
  for await (const chunk of request) {
    text += chunk
    if (Buffer.byteLength(text) > maxBody) throw new Error('body-too-large')
  }
  return JSON.parse(text || '{}')
}

function valid(record) {
  const strings = ['symbol', 'direction', 'thesis', 'providerState']
  if (!record || strings.some((key) => typeof record[key] !== 'string')) return false
  if (!/^[A-Z0-9]{3,20}USDT$/.test(record.symbol) || !['long', 'short'].includes(record.direction)) return false
  if (!['live', 'fallback'].includes(record.providerState) || record.thesis.length > 2000) return false
  for (const key of ['quantity', 'collateral', 'lossBudget', 'endpointMove', 'dipMove']) if (!Number.isFinite(record[key]) || record[key] <= 0) return false
  if (!Array.isArray(record.candles) || record.candles.length > 240) return false
  if (!Array.isArray(record.researchSources) || record.researchSources.length > 6) return false
  if (record.researchSources.some((source) => !source || typeof source.title !== 'string' || source.title.length > 180 || typeof source.note !== 'string' || source.note.length > 800 || typeof source.url !== 'string' || source.url.length > 500 || !['supports', 'counters', 'context'].includes(source.stance) || (() => { try { return new URL(source.url).protocol !== 'https:' } catch { return true } })())) return false
  if (record.ticker !== null && typeof record.ticker !== 'object') return false
  return true
}

function toPublic(record) {
  const { sessionId, ...publicRecord } = record
  return publicRecord
}
function readRehearsal(row) { return row ? parseJson(row.data) : undefined }
function getRehearsal(id) { return readRehearsal(database.prepare('SELECT data FROM rehearsals WHERE id = ?').get(id)) }
function owned(sessionId) { return database.prepare('SELECT data FROM rehearsals WHERE session_id = ? ORDER BY updated_at DESC').all(sessionId).map((row) => toPublic(parseJson(row.data))) }
function ownedCount(sessionId) { return database.prepare('SELECT COUNT(*) AS count FROM rehearsals WHERE session_id = ?').get(sessionId).count }
function saveRehearsal(record, sessionId) { database.prepare('INSERT INTO rehearsals (id, session_id, updated_at, data) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET session_id = excluded.session_id, updated_at = excluded.updated_at, data = excluded.data').run(record.id, sessionId, record.updatedAt, JSON.stringify(record)) }
const allowedSourceHosts = new Set(['bitget.com', 'www.bitget.com', 'bitget.cloud', 'www.bitget.cloud'])
function sourceUrl(raw) {
  const url = new URL(raw)
  if (url.protocol !== 'https:' || !allowedSourceHosts.has(url.hostname.toLowerCase())) throw new Error('source_not_allowed')
  return url
}
function sourceText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}
function sourceTitle(html, fallback) { return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim().slice(0, 180) || fallback }
async function retrieveSource(raw) {
  const url = sourceUrl(raw)
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(url, { redirect: 'error', signal: controller.signal, headers: { accept: 'text/html,text/plain;q=0.9' } })
    if (!response.ok) throw new Error('source_unavailable')
    const type = response.headers.get('content-type') ?? ''
    if (!type.includes('text/html') && !type.includes('text/plain')) throw new Error('source_not_text')
    const text = await response.text()
    if (Buffer.byteLength(text) > 200_000) throw new Error('source_too_large')
    const clean = sourceText(text)
    return { id: randomUUID(), title: sourceTitle(text, url.hostname), url: url.toString(), stance: 'context', note: clean.slice(0, 800), verification: { status: 'verified', fetchedAt: new Date().toISOString(), excerpt: clean.slice(0, 1200), title: sourceTitle(text, url.hostname) } }
  } finally { clearTimeout(timer) }
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === '/healthz') return send(response, 200, { status: 'ok', version, readiness: persistenceMode, aiProvider: anthropicKey ? 'anthropic' : 'unconfigured', aiModel: anthropicKey ? anthropicModel : null, bitgetPrivate: bitgetKey && bitgetSecret && bitgetPassphrase ? 'configured' : 'unconfigured' })
    if (await proxyBitget(request, response)) return
    if (await staticFile(request, response)) return
    if (request.url?.startsWith('/api/public/reports/')) {
      const token = new URL(request.url, 'http://localhost').pathname.split('/').at(-1)
      const share = database.prepare('SELECT rehearsal_id AS rehearsalId, created_at AS createdAt, revoked_at AS revokedAt FROM shares WHERE token = ?').get(token)
      const record = share && getRehearsal(share.rehearsalId)
      if (!share || share.revokedAt || !record) return send(response, 404, { error: 'report_not_found' })
      return send(response, 200, { record: toPublic(record), publishedAt: share.createdAt })
    }
    if (!request.url?.startsWith('/api/workspace/rehearsals') && request.url !== '/api/workspace/research/verify' && request.url !== '/api/workspace/ai/explain' && request.url !== '/api/workspace/liquidation' && request.url !== '/api/analytics/events') return send(response, 404, { error: 'not_found' })
    const current = session(request, response)
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`)
    if (request.method === 'POST' && url.pathname === '/api/workspace/ai/explain') {
      if (!aiQuota(current.id)) return send(response, 429, { error: 'ai_rate_limited' })
      const input = await body(request)
      if (!aiInput(input)) return send(response, 422, { error: 'invalid_ai_input' })
      try { return send(response, 200, await explainWithAnthropic(input)) } catch { return send(response, 502, { status: 'error', provider: 'anthropic', reason: 'AI_PROVIDER_UNAVAILABLE' }) }
    }
    if (request.method === 'POST' && url.pathname === '/api/workspace/liquidation') {
      const input = await body(request)
      if (!validLiqInput(input)) return send(response, 422, { error: 'invalid_liquidation_input' })
      try { return send(response, 200, await signedBitgetGet('/api/v2/mix/account/liq-price', { productType: 'USDT-FUTURES', symbol: input.symbol, posSide: input.direction, orderType: 'limit', marginCoin: 'USDT', openAmount: input.openAmount, openPrice: input.openPrice })) } catch { return send(response, 502, { status: 'error', reason: 'BITGET_PRIVATE_API_UNAVAILABLE' }) }
    }
    if (request.method === 'POST' && url.pathname === '/api/analytics/events') {
      const input = await body(request)
      if (!input || typeof input.name !== 'string' || !/^[a-z0-9_.-]{2,50}$/.test(input.name) || JSON.stringify(input.metadata ?? {}).length > 2000) return send(response, 422, { error: 'invalid_event' })
      database.prepare('INSERT INTO analytics_events (id, session_id, event_name, created_at, metadata) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), current.id, input.name, new Date().toISOString(), JSON.stringify(input.metadata ?? {}))
      return send(response, 200, { accepted: true })
    }
    const collectionPath = '/api/workspace/rehearsals'
    const tail = url.pathname === collectionPath ? '' : url.pathname.slice(`${collectionPath}/`.length)
    const [id, action] = tail.split('/')
    if (request.method === 'POST' && url.pathname === '/api/workspace/research/verify') {
      try { return send(response, 200, { source: await retrieveSource((await body(request)).url), mode: 'server' }) } catch (error) { return send(response, error.message === 'source_not_allowed' ? 422 : 502, { error: error.message === 'source_not_allowed' ? 'source_not_allowed' : 'source_unavailable' }) }
    }
    if (request.method === 'GET' && !id) return send(response, 200, { records: owned(current.id), mode: 'server' })
    if (request.method === 'POST' && !id) {
      const input = await body(request)
      if (!valid(input)) return send(response, 422, { error: 'invalid_rehearsal' })
      const previous = input.id ? getRehearsal(input.id) : undefined
      const previousRow = input.id ? database.prepare('SELECT session_id AS sessionId FROM rehearsals WHERE id = ?').get(input.id) : undefined
      if (previous && previousRow?.sessionId !== current.id) return send(response, 404, { error: 'not_found' })
      if (!previous && ownedCount(current.id) >= maxRecords) return send(response, 429, { error: 'workspace_limit' })
      const now = new Date().toISOString()
      const revision = (previous?.revision ?? 0) + 1
      const revisionSnapshot = { ...input, id: previous?.id ?? randomUUID(), createdAt: previous?.createdAt ?? now, updatedAt: now, revision }
      const saved = { ...revisionSnapshot, id: revisionSnapshot.id, revisions: [...(previous?.revisions ?? []), revisionSnapshot] }
      saveRehearsal(saved, current.id)
      return send(response, 200, { record: toPublic(saved), mode: 'server' })
    }
    if (request.method === 'POST' && id && action === 'share') {
      const record = getRehearsal(id)
      const owner = database.prepare('SELECT session_id AS sessionId FROM rehearsals WHERE id = ?').get(id)
      if (!record || owner?.sessionId !== current.id) return send(response, 404, { error: 'not_found' })
      const token = randomBytes(24).toString('base64url')
      database.prepare('INSERT INTO shares (token, rehearsal_id, session_id, created_at) VALUES (?, ?, ?, ?)').run(token, id, current.id, new Date().toISOString())
      return send(response, 200, { token, url: `/report/${token}` })
    }
    if (request.method === 'DELETE' && id && action === 'share') {
      const record = getRehearsal(id)
      const owner = database.prepare('SELECT session_id AS sessionId FROM rehearsals WHERE id = ?').get(id)
      if (!record || owner?.sessionId !== current.id) return send(response, 404, { error: 'not_found' })
      database.prepare('UPDATE shares SET revoked_at = ? WHERE rehearsal_id = ? AND revoked_at IS NULL').run(new Date().toISOString(), id)
      return send(response, 200, { revoked: true })
    }
    if (request.method === 'GET' && id && action === 'export') {
      const record = getRehearsal(id)
      const owner = database.prepare('SELECT session_id AS sessionId FROM rehearsals WHERE id = ?').get(id)
      if (!record || owner?.sessionId !== current.id) return send(response, 404, { error: 'not_found' })
      const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'json'
      const publicRecord = toPublic(record)
      if (format === 'json') {
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="veltryn-${id}.json"`, 'cache-control': 'no-store' })
        return response.end(JSON.stringify(publicRecord, null, 2))
      }
      const rows = [['revision', 'updatedAt', 'symbol', 'direction', 'quantity', 'collateral', 'lossBudget', 'endpointMove', 'dipMove', 'thesis', 'researchSources']]
      for (const item of publicRecord.revisions ?? [publicRecord]) rows.push([item.revision, item.updatedAt, item.symbol, item.direction, item.quantity, item.collateral, item.lossBudget, item.endpointMove, item.dipMove, item.thesis, (item.researchSources ?? []).length])
      const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
      response.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="veltryn-${id}.csv"`, 'cache-control': 'no-store' })
      return response.end(csv)
    }
    if (request.method === 'DELETE' && id) {
      const record = getRehearsal(id)
      const owner = database.prepare('SELECT session_id AS sessionId FROM rehearsals WHERE id = ?').get(id)
      if (!record || owner?.sessionId !== current.id) return send(response, 404, { error: 'not_found' })
      database.prepare('DELETE FROM rehearsals WHERE id = ?').run(id)
      return send(response, 200, { records: owned(current.id), mode: 'server' })
    }
    return send(response, 404, { error: 'not_found' })
  } catch (error) {
    send(response, error.message === 'body-too-large' ? 413 : 400, { error: 'invalid_request' })
  }
})

server.listen(port, host, () => console.log(`Veltryn workspace API listening on ${host}:${port}`))
process.once('SIGTERM', () => server.close(() => { database.close(); process.exit(0) }))
process.once('SIGINT', () => server.close(() => { database.close(); process.exit(0) }))
