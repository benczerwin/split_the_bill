import type { BillState, Item, PersonResult, SplitSummary } from '../types'

const EPSILON = 0.01

function participantsFor(item: Item, allPersonIds: string[]): string[] {
  return item.assignedTo.length === 0 ? allPersonIds : item.assignedTo
}

export function itemShareForPerson(item: Item, personId: string, allPersonIds: string[]): number {
  const participants = participantsFor(item, allPersonIds)
  if (!participants.includes(personId) || participants.length === 0) return 0
  return item.price / participants.length
}

export function computeSplit(state: BillState): SplitSummary {
  const allPersonIds = state.people.map((p) => p.id)
  const subtotal = state.items.reduce((sum, item) => sum + (Number.isFinite(item.price) ? item.price : 0), 0)
  const tipAmount = state.tipMode === 'percent' ? subtotal * (state.tipValue / 100) : state.tipValue
  const totalWithTaxTip = subtotal + state.tax + tipAmount

  const unassignedItems = state.items.filter((item) => participantsFor(item, allPersonIds).length === 0)

  const results: PersonResult[] = state.people.map((person) => {
    const itemCost = state.items.reduce(
      (sum, item) => sum + itemShareForPerson(item, person.id, allPersonIds),
      0,
    )
    const shareFraction = subtotal > 0 ? itemCost / subtotal : 0
    const costWithTaxTip = subtotal > 0 ? itemCost + shareFraction * (state.tax + tipAmount) : 0
    const costWithCashBack = costWithTaxTip * (1 - state.cashBackPercent / 100)
    return { person, shareFraction, itemCost, costWithTaxTip, costWithCashBack }
  })

  const sumOfShares = results.reduce((sum, r) => sum + r.costWithTaxTip, 0)
  const isBalanced = Math.abs(sumOfShares - totalWithTaxTip) < EPSILON

  return { subtotal, tipAmount, totalWithTaxTip, results, unassignedItems, isBalanced }
}

export function formatCurrency(value: number, currency: string = 'USD'): string {
  const safeValue = Number.isFinite(value) ? value : 0
  try {
    return safeValue.toLocaleString('en-US', { style: 'currency', currency })
  } catch {
    return `${currency} ${safeValue.toFixed(2)}`
  }
}

/** Multiplies every money field in a summary by a scale factor — used to re-express a bill's
 *  split in a different currency (e.g. the amount your card was actually charged) without
 *  redoing the underlying item-split math. */
export function scaleSummary(summary: SplitSummary, scale: number): SplitSummary {
  if (scale === 1) return summary
  return {
    ...summary,
    subtotal: summary.subtotal * scale,
    tipAmount: summary.tipAmount * scale,
    totalWithTaxTip: summary.totalWithTaxTip * scale,
    results: summary.results.map((r) => ({
      ...r,
      itemCost: r.itemCost * scale,
      costWithTaxTip: r.costWithTaxTip * scale,
      costWithCashBack: r.costWithCashBack * scale,
    })),
  }
}
