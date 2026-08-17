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
}

/** A single-bill snapshot kept on-device so it can be added into a combine session without
 *  re-exporting/re-uploading a PDF. */
export interface SavedReceipt {
  id: string
  savedAt: string
  bill: BillState
}
