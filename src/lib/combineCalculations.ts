import type { CombineReceiptEntry, SettleGroupBy } from '../types'

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

export function groupSettlements(settlements: Settlement[], groupBy: SettleGroupBy): [string, Settlement[]][] {
  const groups = new Map<string, Settlement[]>()
  for (const s of settlements) {
    const key = groupBy === 'payer' ? s.fromName : s.toName
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }
  return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
}
