import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataFile = resolve(process.env.VELTRYN_DATA_FILE ?? `${root}/.private/workspace-data.json`)
const port = Number(process.env.PORT ?? 8787)
const maxBody = 64 * 1024
const maxRecords = 50

let store = { sessions: {}, rehearsals: {}, shares: {} }
try { store = JSON.parse(await readFile(dataFile, 'utf8')) } catch { await persist() }
store.sessions ??= {}; store.rehearsals ??= {}; store.shares ??= {}

async function persist() {
  await mkdir(dirname(dataFile), { recursive: true })
  await writeFile(dataFile, JSON.stringify(store, null, 2), 'utf8')
}

function digest(value) { return createHash('sha256').update(value).digest('hex') }
function cookieValue(request) { return request.headers.cookie?.match(/(?:^|; )veltryn_session=([^;]+)/)?.[1] }
function session(request, response) {
  const raw = cookieValue(request)
  const key = raw && digest(raw)
  if (key && store.sessions[key]) return store.sessions[key]
  const token = randomBytes(32).toString('base64url')
  const sessionId = digest(token)
  store.sessions[sessionId] = { id: sessionId, createdAt: new Date().toISOString() }
  response.setHeader('Set-Cookie', `veltryn_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`)
  return store.sessions[sessionId]
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(body))
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
function owned(sessionId) { return Object.values(store.rehearsals).filter((record) => record.sessionId === sessionId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(toPublic) }
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
    if (request.url?.startsWith('/api/public/reports/')) {
      const token = new URL(request.url, 'http://localhost').pathname.split('/').at(-1)
      const share = store.shares[token]
      const record = share && store.rehearsals[share.rehearsalId]
      if (!share || share.revokedAt || !record) return send(response, 404, { error: 'report_not_found' })
      return send(response, 200, { record: toPublic(record), publishedAt: share.createdAt })
    }
    if (!request.url?.startsWith('/api/workspace/rehearsals') && request.url !== '/api/workspace/research/verify') return send(response, 404, { error: 'not_found' })
    const current = session(request, response)
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`)
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
      const previous = input.id ? store.rehearsals[input.id] : undefined
      if (previous && previous.sessionId !== current.id) return send(response, 404, { error: 'not_found' })
      if (!previous && owned(current.id).length >= maxRecords) return send(response, 429, { error: 'workspace_limit' })
      const now = new Date().toISOString()
      const revision = (previous?.revision ?? 0) + 1
      const revisionSnapshot = { ...input, id: previous?.id ?? randomUUID(), createdAt: previous?.createdAt ?? now, updatedAt: now, revision }
      const saved = { ...revisionSnapshot, id: revisionSnapshot.id, sessionId: current.id, revisions: [...(previous?.revisions ?? []), revisionSnapshot] }
      store.rehearsals[saved.id] = saved
      await persist()
      return send(response, 200, { record: toPublic(saved), mode: 'server' })
    }
    if (request.method === 'POST' && id && action === 'share') {
      const record = store.rehearsals[id]
      if (!record || record.sessionId !== current.id) return send(response, 404, { error: 'not_found' })
      const token = randomBytes(24).toString('base64url')
      store.shares[token] = { rehearsalId: id, sessionId: current.id, createdAt: new Date().toISOString() }
      await persist()
      return send(response, 200, { token, url: `/report/${token}` })
    }
    if (request.method === 'DELETE' && id && action === 'share') {
      const record = store.rehearsals[id]
      if (!record || record.sessionId !== current.id) return send(response, 404, { error: 'not_found' })
      for (const share of Object.values(store.shares)) if (share.rehearsalId === id && !share.revokedAt) share.revokedAt = new Date().toISOString()
      await persist()
      return send(response, 200, { revoked: true })
    }
    if (request.method === 'GET' && id && action === 'export') {
      const record = store.rehearsals[id]
      if (!record || record.sessionId !== current.id) return send(response, 404, { error: 'not_found' })
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
      const record = store.rehearsals[id]
      if (!record || record.sessionId !== current.id) return send(response, 404, { error: 'not_found' })
      delete store.rehearsals[id]
      await persist()
      return send(response, 200, { records: owned(current.id), mode: 'server' })
    }
    return send(response, 404, { error: 'not_found' })
  } catch (error) {
    send(response, error.message === 'body-too-large' ? 413 : 400, { error: 'invalid_request' })
  }
})

server.listen(port, '127.0.0.1', () => console.log(`Veltryn workspace API listening on http://127.0.0.1:${port}`))
