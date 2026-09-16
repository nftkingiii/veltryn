import type { Candle } from '../providers/bitget'

export type HistoricalAnalogue = { start: number; end: number; similarity: number; forwardReturn: number | null }

function closes(candles: Candle[]) { return [...candles].sort((a, b) => Number(a[0]) - Number(b[0])).map((candle) => Number(candle[4])).filter((value) => Number.isFinite(value) && value > 0) }
function shape(values: number[]) { const base = values[0]; return values.map((value) => value / base - 1) }

export function findHistoricalAnalogues(candles: Candle[], window = 8, count = 3): HistoricalAnalogue[] {
  const values = closes(candles)
  if (values.length < window * 2 + 2) return []
  const target = shape(values.slice(-window))
  const matches: HistoricalAnalogue[] = []
  for (let end = window; end <= values.length - window; end += 1) {
    if (end > values.length - window - 1) break
    const candidate = shape(values.slice(end - window, end))
    const distance = Math.sqrt(candidate.reduce((sum, value, index) => sum + (value - target[index]) ** 2, 0) / window)
    const forward = values[end + window] / values[end] - 1
    matches.push({ start: end - window, end, similarity: Math.max(0, 1 - distance * 8), forwardReturn: Number.isFinite(forward) ? forward : null })
  }
  return matches.sort((a, b) => b.similarity - a.similarity).filter((match, index, all) => index === 0 || match.start - all[index - 1].end >= window / 2).slice(0, count)
}
