import { describe, expect, it } from 'vitest'
import { makePath, stressPath, type PositionPlan } from '../src/domain/engine'

const base: PositionPlan = { direction: 'long', entryPrice: 100, quantity: 10, collateral: 1000, lossBudget: 180, feeRate: 0, fundingRate: 0, fundingPeriods: 0 }

describe('stress engine', () => {
  it('keeps terminal PnL directionally correct for a long', () => {
    expect(stressPath(base, [{ label: 'entry', price: 100 }, { label: 'end', price: 110 }]).terminalPnl).toBe(100)
  })
  it('credits a short when funding is positive', () => {
    const result = stressPath({ ...base, direction: 'short', fundingRate: 0.01, fundingPeriods: 1 }, [{ label: 'end', price: 100 }])
    expect(result.funding).toBe(-10)
    expect(result.terminalPnl).toBe(10)
  })
  it('marks the first loss budget breach on an adverse recovery path', () => {
    const result = stressPath({ ...base, lossBudget: 50 }, makePath(100, 'long', 0.1, 0.08))
    expect(result.budgetBreachAt).toBe('First shock')
    expect(result.status).toBe('budget-breached')
  })
})
