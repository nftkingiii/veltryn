export type Direction = 'long' | 'short'

export type PositionPlan = {
  direction: Direction
  entryPrice: number
  quantity: number
  collateral: number
  lossBudget: number
  feeRate: number
  fundingRate: number
  fundingPeriods: number
  stopPrice?: number
}

export type PathPoint = { label: string; price: number; note?: string }

export type StressResult = {
  terminalPnl: number
  worstPnl: number
  worstDrawdown: number
  budgetBreachAt?: string
  stopTriggeredAt?: string
  fees: number
  funding: number
  terminalEquity: number
  status: 'within-budget' | 'budget-breached' | 'stop-triggered'
}

const sign = (direction: Direction) => direction === 'long' ? 1 : -1

export function validatePlan(plan: PositionPlan): string[] {
  const errors: string[] = []
  if (!Number.isFinite(plan.entryPrice) || plan.entryPrice <= 0) errors.push('Entry price must be greater than zero.')
  if (!Number.isFinite(plan.quantity) || plan.quantity <= 0) errors.push('Quantity must be greater than zero.')
  if (!Number.isFinite(plan.collateral) || plan.collateral <= 0) errors.push('Collateral must be greater than zero.')
  if (!Number.isFinite(plan.lossBudget) || plan.lossBudget <= 0) errors.push('Loss budget must be greater than zero.')
  if (plan.stopPrice !== undefined && (!Number.isFinite(plan.stopPrice) || plan.stopPrice <= 0)) errors.push('Stop price must be greater than zero.')
  return errors
}

export function stressPath(plan: PositionPlan, path: PathPoint[]): StressResult {
  const errors = validatePlan(plan)
  if (errors.length) throw new Error(errors[0])
  const direction = sign(plan.direction)
  const notional = plan.entryPrice * plan.quantity
  const fees = notional * plan.feeRate * 2
  const funding = notional * plan.fundingRate * plan.fundingPeriods * direction
  let worstPnl = 0
  let budgetBreachAt: string | undefined
  let stopTriggeredAt: string | undefined
  let terminalPnl = 0
  for (const point of path) {
    const pnl = direction * plan.quantity * (point.price - plan.entryPrice) - fees - funding
    terminalPnl = pnl
    worstPnl = Math.min(worstPnl, pnl)
    if (!budgetBreachAt && pnl <= -plan.lossBudget) budgetBreachAt = point.label
    const stopHit = plan.stopPrice !== undefined && (plan.direction === 'long' ? point.price <= plan.stopPrice : point.price >= plan.stopPrice)
    if (!stopTriggeredAt && stopHit) stopTriggeredAt = point.label
  }
  const status = stopTriggeredAt ? 'stop-triggered' : budgetBreachAt ? 'budget-breached' : 'within-budget'
  return { terminalPnl, worstPnl, worstDrawdown: Math.abs(worstPnl), budgetBreachAt, stopTriggeredAt, fees, funding, terminalEquity: plan.collateral + terminalPnl, status }
}

export function makePath(entryPrice: number, direction: Direction, endpointMove: number, dipMove: number): PathPoint[] {
  const s = sign(direction)
  return [
    { label: 'Entry', price: entryPrice, note: 'Position opened' },
    { label: 'First shock', price: entryPrice * (1 - s * dipMove), note: 'Adverse move before the thesis plays out' },
    { label: 'Reprice', price: entryPrice * (1 + s * endpointMove * 0.45) },
    { label: 'Thesis window', price: entryPrice * (1 + s * endpointMove), note: 'Same endpoint for both paths' },
  ]
}
