import type { RehearsalRecord, ResearchSource } from '../domain/storage'

const API = '/api/workspace/rehearsals'
type RecordInput = Omit<RehearsalRecord, 'id' | 'createdAt' | 'updatedAt' | 'revision'>

async function request<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, { ...init, credentials: 'include', headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } })
  if (!response.ok) throw new Error(`workspace_${response.status}`)
  return response.json() as Promise<T>
}

export async function loadRemoteRehearsals() {
  return request<{ records: RehearsalRecord[]; mode: 'server' }>(API)
}

export async function persistRemoteRehearsal(record: RecordInput, existingId?: string) {
  return request<{ record: RehearsalRecord; mode: 'server' }>(API, { method: 'POST', body: JSON.stringify({ ...record, ...(existingId ? { id: existingId } : {}) }) })
}

export async function removeRemoteRehearsal(id: string) {
  return request<{ records: RehearsalRecord[]; mode: 'server' }>(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function verifyRemoteSource(url: string) {
  return request<{ source: ResearchSource; mode: 'server' }>('/api/workspace/research/verify', { method: 'POST', body: JSON.stringify({ url }) })
}

export async function createRemoteShare(id: string) {
  return request<{ url: string; token: string }>(`${API}/${encodeURIComponent(id)}/share`, { method: 'POST', body: '{}' })
}

export async function loadPublicReport(token: string) {
  return request<{ record: RehearsalRecord; publishedAt: string }>(`/api/public/reports/${encodeURIComponent(token)}`)
}
