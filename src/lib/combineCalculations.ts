import type { CombineReceiptEntry, SettleGroupBy } from '../types'
import { scaleSummary } from './calculations'
import { combinedScaleForBill } from './currency'

export interface CombinedPerson {
  key: string
  name: string
  colorIndex: number
  perReceipt: Record<string, number>
  total: number
}

export interface Balance {
  key: string
  name: string
  colorIndex: number
  paid: number
  owed: number
  net: number
}

export interface Settlement {
  fromName: string
  toName: string
  amount: number
}

export const SETTLEMENT_EPSILON = 0.005

// One shared color per person name across the whole combine view — each bill assigned its
// own colorIndex independently when it was created, so without this the same person could
// show up in a different color in each receipt section vs. the combined tables.
export function buildNameColorMap(entries: CombineReceiptEntry[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const entry of entries) {
    if (entry.status !== 'done' || !entry.bill) continue
    for (const person of entry.bill.people) {
      const key = person.name.trim().toLowerCase()
      if (!map.has(key)) map.set(key, map.size)
    }
  }
  return map
}

export function applyCashBack(costWithTaxTip: number, cashBackPercent: number): number {
  return cashBackPercent > 0 ? costWithTaxTip * (1 - cashBackPercent / 100) : costWithTaxTip
}

export function buildCombined(
  entries: CombineReceiptEntry[],
  nameColorMap: Map<string, number>,
  cashBackPercent: number,
): CombinedPerson[] {
  const byKey = new Map<string, CombinedPerson>()
  for (const entry of entries) {
    if (entry.status !== 'done' || !entry.summary) continue
    for (const r of entry.summary.results) {
      const key = r.person.name.trim().toLowerCase()
      let combined = byKey.get(key)
      if (!combined) {
        combined = { key, name: r.person.name.trim(), colorIndex: nameColorMap.get(key) ?? byKey.size, perReceipt: {}, total: 0 }
        byKey.set(key, combined)
      }
      const amount = applyCashBack(r.costWithTaxTip, cashBackPercent)
      combined.perReceipt[entry.id] = amount
      combined.total += amount
    }
  }
  return Array.from(byKey.values()).sort((a, b) => b.total - a.total)
}

// Balances always use the full bill total for what a payer fronted — cash back is a discount the
// payer chooses to offer people paying them back in cash, it doesn't change what was actually
// handed to the restaurant.
export function buildBalances(
  entries: CombineReceiptEntry[],
  combined: CombinedPerson[],
  nameColorMap: Map<string, number>,
): Balance[] {
  const byKey = new Map<string, Balance>()
  for (const c of combined) {
    byKey.set(c.key, { key: c.key, name: c.name, colorIndex: c.colorIndex, paid: 0, owed: c.total, net: 0 })
  }
  for (const entry of entries) {
    if (entry.status !== 'done' || !entry.bill || !entry.summary || !entry.payerId) continue
    const payer = entry.bill.people.find((p) => p.id === entry.payerId)
    if (!payer) continue
    const key = payer.name.trim().toLowerCase()
    let balance = byKey.get(key)
    if (!balance) {
      balance = { key, name: payer.name.trim(), colorIndex: nameColorMap.get(key) ?? byKey.size, paid: 0, owed: 0, net: 0 }
      byKey.set(key, balance)
    }
    balance.paid += entry.summary.totalWithTaxTip
  }
  for (const balance of byKey.values()) balance.net = balance.paid - balance.owed
  return Array.from(byKey.values()).sort((a, b) => b.net - a.net)
}

// Greedily matches the biggest creditor against the biggest debtor until every balance is
// settled — a standard debt-simplification approach that keeps the payment list short.
export function simplifySettlements(balances: Balance[]): Settlement[] {
  const creditors = balances
    .filter((b) => b.net > SETTLEMENT_EPSILON)
    .map((b) => ({ name: b.name, amount: b.net }))
    .sort((a, b) => b.amount - a.amount)
  const debtors = balances
    .filter((b) => b.net < -SETTLEMENT_EPSILON)
    .map((b) => ({ name: b.name, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount)

  const settlements: Settlement[] = []
  let i = 0
  let j = 0
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i]
    const debtor = debtors[j]
    const amount = Math.min(creditor.amount, debtor.amount)
    if (amount > SETTLEMENT_EPSILON) settlements.push({ fromName: debtor.name, toName: creditor.name, amount })
    creditor.amount -= amount
    debtor.amount -= amount
    if (creditor.amount <= SETTLEMENT_EPSILON) i++
    if (debtor.amount <= SETTLEMENT_EPSILON) j++
  }
  return settlements
}

function mostCommon(values: string[]): string | null {
  if (values.length === 0) return null
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best = values[0]
  let bestCount = 0
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v
      bestCount = c
    }
  }
  return best
}

/** Picks one settlement currency for the whole combine session. Prefers whatever currency
 *  receipts were actually charged in (their entered bank total), since that's real money that
 *  changed hands; falls back to the receipts' own bill currencies if none of them recorded a
 *  charged total, and finally to USD if the session is empty. An explicit override always wins. */
export function determineCombinedCurrency(entries: CombineReceiptEntry[], override?: string | null): string {
  if (override) return override
  const chargedCurrencies = entries
    .filter((e) => e.status === 'done' && e.bill?.chargedTotal != null)
    .map((e) => e.bill!.chargedCurrency ?? e.bill!.currency)
  const pickedCharged = mostCommon(chargedCurrencies)
  if (pickedCharged) return pickedCharged
  const billCurrencies = entries.filter((e) => e.status === 'done' && e.bill).map((e) => e.bill!.currency)
  return mostCommon(billCurrencies) ?? 'USD'
}

/** Whether combining this session's receipts into one currency requires a live exchange rate
 *  (i.e. some receipt's own currency doesn't already match the combined currency and it has no
 *  matching entered charged total to fall back on). */
export function combineNeedsExchangeRates(entries: CombineReceiptEntry[], combinedCurrency: string): boolean {
  return entries.some((e) => {
    if (e.status !== 'done' || !e.bill) return false
    const chargedCurrency = e.bill.chargedCurrency ?? e.bill.currency
    if (e.bill.chargedTotal != null) return chargedCurrency !== combinedCurrency
    return e.bill.currency !== combinedCurrency
  })
}

/** Rewrites each entry's summary into the combined session's shared currency, so downstream
 *  totals/balances can keep summing plain numbers as before. */
export function scaleEntriesToCurrency(
  entries: CombineReceiptEntry[],
  combinedCurrency: string,
  usdRates: Record<string, number> | null,
): CombineReceiptEntry[] {
  return entries.map((e) => {
    if (e.status !== 'done' || !e.bill || !e.summary) return e
    const scale = combinedScaleForBill(e.bill, e.summary.totalWithTaxTip, combinedCurrency, usdRates)
    if (scale === 1) return e
    return { ...e, summary: scaleSummary(e.summary, scale) }
  })
}

export function groupSettlements(settlements: Settlement[], groupBy: SettleGroupBy): [string, Settlement[]][] {
  const groups = new Map<string, Settlement[]>()
  for (const s of settlements) {
    const key = groupBy === 'payer' ? s.fromName : s.toName
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }
  return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
}
