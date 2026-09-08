import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const port = 8899
const dataDir = await mkdtemp(join(tmpdir(), 'veltryn-eval-'))
const child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port), VELTRYN_DATA_FILE: join(dataDir, 'workspace.json'), VELTRYN_VERSION: 'evaluation' }, stdio: ['ignore', 'pipe', 'pipe'] })
const base = `http://127.0.0.1:${port}`
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
for (let i = 0; i < 30; i += 1) { try { if ((await fetch(`${base}/healthz`)).ok) break } catch {} await wait(100) }
const cookie = (response) => response.headers.get('set-cookie')?.split(';')[0] ?? ''
const request = (path, options = {}) => fetch(`${base}${path}`, { ...options, headers: { cookie: options.cookie ?? '', 'content-type': 'application/json', ...(options.headers ?? {}) } })
const body = { symbol: 'NVDAUSDT', direction: 'long', quantity: 0.1, collateral: 1000, lossBudget: 180, endpointMove: 0.06, dipMove: 0.09, thesis: 'Held-out evaluation claim', providerState: 'fallback', ticker: null, candles: [], researchSources: [] }
const health = await fetch(`${base}/healthz`)
const first = await request('/api/workspace/rehearsals', { method: 'GET' })
const sessionA = cookie(first)
const created = await request('/api/workspace/rehearsals', { method: 'POST', cookie: sessionA, body: JSON.stringify(body) })
const record = await created.json()
const disallowed = await request('/api/workspace/research/verify', { method: 'POST', cookie: sessionA, body: JSON.stringify({ url: 'https://example.com' }) })
const shared = await request(`/api/workspace/rehearsals/${record.record.id}/share`, { method: 'POST', cookie: sessionA, body: '{}' })
const share = await shared.json()
const publicBefore = await fetch(`${base}/api/public/reports/${share.token}`)
const revoked = await request(`/api/workspace/rehearsals/${record.record.id}/share`, { method: 'DELETE', cookie: sessionA })
const publicAfter = await fetch(`${base}/api/public/reports/${share.token}`)
const result = { health: health.status === 200, sessionScopedRecord: created.status === 200, disallowedSourceRejected: disallowed.status === 422, publicShareBeforeRevocation: publicBefore.status === 200, revocationSucceeded: revoked.status === 200, publicShareAfterRevocation: publicAfter.status === 404 }
console.log(JSON.stringify(result, null, 2))
child.kill(); await rm(dataDir, { recursive: true, force: true })
if (Object.values(result).some((value) => !value)) process.exitCode = 1
