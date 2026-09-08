import type { Candle, Ticker } from '../providers/bitget'
import type { Direction } from './engine'
import { loadRemoteRehearsals, persistRemoteRehearsal, removeRemoteRehearsal } from '../providers/workspace'

const STORAGE_KEY = 'veltryn.rehearsals.v1'

export type RehearsalRecord = {
  id: string
  createdAt: string
  updatedAt: string
  revision: number
  symbol: string
  direction: Direction
  quantity: number
  collateral: number
  lossBudget: number
  endpointMove: number
  dipMove: number
  thesis: string
  providerState: 'live' | 'fallback'
  ticker: Ticker | null
  candles: Candle[]
  researchSources: ResearchSource[]
  revisions?: RehearsalRevision[]
}

export type ResearchSource = { id: string; title: string; url: string; stance: 'supports' | 'counters' | 'context'; note: string }
export type RehearsalRevision = Omit<RehearsalRecord, 'revisions'> & { revision: number }

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function loadRehearsals(): RehearsalRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is RehearsalRecord => Boolean(item && typeof item === 'object' && typeof item.id === 'string' && typeof item.symbol === 'string'))
  } catch {
    return []
  }
}

export function persistRehearsal(record: Omit<RehearsalRecord, 'id' | 'createdAt' | 'updatedAt' | 'revision' | 'revisions'>, existingId?: string) {
  const current = loadRehearsals()
  const previous = existingId ? current.find((item) => item.id === existingId) : undefined
  const now = new Date().toISOString()
  const saved: RehearsalRecord = {
    ...record,
    id: previous?.id ?? makeId(),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    revision: (previous?.revision ?? 0) + 1,
  }
  const next = [saved, ...current.filter((item) => item.id !== saved.id)]
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return saved
}

export function removeRehearsal(id: string) {
  const next = loadRehearsals().filter((item) => item.id !== id)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export async function loadRehearsalsWithFallback() {
  try {
    const remote = await loadRemoteRehearsals()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remote.records))
    return { records: remote.records, mode: 'server' as const }
  } catch {
    return { records: loadRehearsals(), mode: 'browser' as const }
  }
}

export async function persistRehearsalWithFallback(record: Omit<RehearsalRecord, 'id' | 'createdAt' | 'updatedAt' | 'revision' | 'revisions'>, existingId?: string) {
  const local = persistRehearsal(record, existingId)
  try {
    const remote = await persistRemoteRehearsal(record, existingId)
    const records = loadRehearsals().filter((item) => item.id !== local.id && item.id !== remote.record.id)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([remote.record, ...records]))
    return { record: remote.record, mode: 'server' as const }
  } catch {
    return { record: local, mode: 'browser' as const }
  }
}

export async function removeRehearsalWithFallback(id: string) {
  const local = removeRehearsal(id)
  try {
    const remote = await removeRemoteRehearsal(id)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remote.records))
    return { records: remote.records, mode: 'server' as const }
  } catch {
    return { records: local, mode: 'browser' as const }
  }
}
