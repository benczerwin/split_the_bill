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
