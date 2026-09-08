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

let store = { sessions: {}, rehearsals: {} }
try { store = JSON.parse(await readFile(dataFile, 'utf8')) } catch { await persist() }

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
  if (record.ticker !== null && typeof record.ticker !== 'object') return false
  return true
}

function toPublic(record) {
  const { sessionId, ...publicRecord } = record
  return publicRecord
}
function owned(sessionId) { return Object.values(store.rehearsals).filter((record) => record.sessionId === sessionId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(toPublic) }

const server = http.createServer(async (request, response) => {
  try {
    if (!request.url?.startsWith('/api/workspace/rehearsals')) return send(response, 404, { error: 'not_found' })
    const current = session(request, response)
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`)
    const collectionPath = '/api/workspace/rehearsals'
    const id = url.pathname === collectionPath ? undefined : url.pathname.slice(`${collectionPath}/`.length)
    if (request.method === 'GET' && !id) return send(response, 200, { records: owned(current.id), mode: 'server' })
    if (request.method === 'POST' && !id) {
      const input = await body(request)
      if (!valid(input)) return send(response, 422, { error: 'invalid_rehearsal' })
      const previous = input.id ? store.rehearsals[input.id] : undefined
      if (previous && previous.sessionId !== current.id) return send(response, 404, { error: 'not_found' })
      if (!previous && owned(current.id).length >= maxRecords) return send(response, 429, { error: 'workspace_limit' })
      const now = new Date().toISOString()
      const saved = { ...input, id: previous?.id ?? randomUUID(), sessionId: current.id, createdAt: previous?.createdAt ?? now, updatedAt: now, revision: (previous?.revision ?? 0) + 1 }
      store.rehearsals[saved.id] = saved
      await persist()
      return send(response, 200, { record: toPublic(saved), mode: 'server' })
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
