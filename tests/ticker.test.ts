import { afterEach, expect, it, vi } from 'vitest'
import { getTicker } from '../src/providers/bitget'
afterEach(() => vi.unstubAllGlobals())
it('matches the requested symbol even when the endpoint returns all markets', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({code:'00000', requestTime:1, data:[{symbol:'BTCUSDT',lastPr:'78000'},{symbol:'NVDAUSDT',lastPr:'232'}]}) }))
  expect((await getTicker('NVDAUSDT')).ticker.lastPr).toBe('232')
  await expect(getTicker('TSLAUSDT')).rejects.toThrow('no valid ticker')
})
