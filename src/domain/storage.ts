import type { Candle, Ticker } from '../providers/bitget'
import type { Direction } from './engine'

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
}

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

export function persistRehearsal(record: Omit<RehearsalRecord, 'id' | 'createdAt' | 'updatedAt' | 'revision'>, existingId?: string) {
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
