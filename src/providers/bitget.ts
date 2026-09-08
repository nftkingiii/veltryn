export type Instrument = {
  symbol: string
  symbolType?: string
  baseCoin: string
  quoteCoin: string
  isRwa: string
  minTradeNum: string
  minTradeUSDT: string
  makerFeeRate: string
  takerFeeRate: string
  fundInterval: string
  maxLever: string
  pricePlace: string
  volumePlace: string
}

export type Ticker = { symbol: string; lastPr: string; bidPr: string; askPr: string; indexPrice: string; markPrice: string; fundingRate: string; ts: string }
export type Candle = [string, string, string, string, string, string, string]
const API = import.meta.env.VITE_BITGET_API_BASE || '/api/bitget'

async function get<T>(path: string): Promise<{ data: T; requestTime: number }> {
  const response = await fetch(`${API}${path}`)
  if (!response.ok) throw new Error(`Bitget market request failed (${response.status}).`)
  const body = await response.json() as { code: string; msg: string; requestTime: number; data: T }
  if (body.code !== '00000') throw new Error(body.msg || 'Bitget market request failed.')
  return { data: body.data, requestTime: body.requestTime }
}

export async function listRwaInstruments() {
  const result = await get<Instrument[]>('/contracts?productType=USDT-FUTURES')
  return result.data.filter((item) => item.isRwa === 'YES' && item.symbolType === 'perpetual')
}

export async function getTicker(symbol: string) {
  const result = await get<Ticker[]>(`/tickers?productType=USDT-FUTURES&symbol=${encodeURIComponent(symbol)}`)
  return { ticker: result.data[0], requestTime: result.requestTime }
}

export async function getCandles(symbol: string, limit = 120) {
  const result = await get<Candle[]>(`/candles?symbol=${encodeURIComponent(symbol)}&productType=USDT-FUTURES&granularity=1H&limit=${limit}`)
  return { candles: result.data, requestTime: result.requestTime }
}
