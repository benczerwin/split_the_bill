export interface Person {
  id: string
  name: string
  colorIndex: number
}

export interface Item {
  id: string
  name: string
  price: number
  /** Person ids sharing this item. Empty array means "split evenly among everyone". */
  assignedTo: string[]
}

export type TipMode = 'amount' | 'percent'

export interface BillState {
  title: string
  /** date input value, e.g. "2026-08-14" */
  date: string
  people: Person[]
  items: Item[]
  tax: number
  tipMode: TipMode
  tipValue: number
  cashBackPercent: number
  paid: Record<string, boolean>
  /** Person id who fronted the money for this bill, or null if unset. Carries over automatically
   *  when this bill is added into a Combine Receipts session. */
  payerId: string | null
  /** ISO 4217 currency code the amounts above were entered in (what's printed on the receipt). */
  currency: string
  /** Currency your card/bank actually charged you in, if different from `currency`; null means
   *  no conversion is needed. */
  chargedCurrency: string | null
  /** The actual total charged in `chargedCurrency`, straight from your bank statement. Each
   *  person's share is scaled proportionally against this instead of the bill-currency total.
   *  Null means it's not known — fall back to a live exchange rate. */
  chargedTotal: number | null
}

export interface PersonResult {
  person: Person
  shareFraction: number
  itemCost: number
  costWithTaxTip: number
  costWithCashBack: number
}

export interface SplitSummary {
  subtotal: number
  tipAmount: number
  totalWithTaxTip: number
  results: PersonResult[]
  unassignedItems: Item[]
  isBalanced: boolean
}

export type AppMode = 'single' | 'combine'

export type Theme = 'light' | 'dark' | 'system'

export interface CombineReceiptEntry {
  id: string
  fileName: string
  status: 'loading' | 'done' | 'error'
  error?: string
  bill?: BillState
  summary?: SplitSummary
  /** Person id (within this receipt's own people list) who fronted the money, or null if unset. */
  payerId: string | null
  expanded: boolean
  /** Id of the SavedReceipt this came from, if added via the local library rather than a file upload. */
  libraryId?: string
}

export type SettleGroupBy = 'payer' | 'payee'

export interface CombineState {
  receipts: CombineReceiptEntry[]
  cashBackPercent: number
  settleGroupBy: SettleGroupBy
  /** Forces the combined totals/balances to display in this currency instead of the
   *  auto-inferred one; null means auto-infer from the receipts. */
  currencyOverride: string | null
}

/** A single-bill snapshot kept on-device so it can be added into a combine session without
 *  re-exporting/re-uploading a PDF. */
export interface SavedReceipt {
  id: string
  savedAt: string
  bill: BillState
}
