import type { BillState } from '../types'
import { toDateOnly } from './dateUtils'

/** Compact, QR-friendly encoding of a bill — short keys, person indices instead of ids/colors. */
export interface CompactBill {
  v: 1
  n: string // title
  d?: string // date ("YYYY-MM-DD") — optional so older exports without it still decode
  p: string[] // person names, array index doubles as their id
  i: [string, number, number[]][] // [name, price, assignedPersonIndices] — [] means everyone
  t: number // tax
  tm: 0 | 1 // tip mode: 0 = amount, 1 = percent
  tv: number // tip value
  cb: number // cash back %
}

export const BILL_QR_PREFIX = 'STB1:'

function uid(): string {
  return crypto.randomUUID()
}

export function billStateToCompact(state: BillState): CompactBill {
  const indexOf = new Map(state.people.map((p, idx) => [p.id, idx]))
  return {
    v: 1,
    n: state.title,
    d: state.date,
    p: state.people.map((p) => p.name),
    i: state.items.map((item) => [
      item.name,
      item.price,
      item.assignedTo.map((id) => indexOf.get(id)).filter((idx): idx is number => idx !== undefined),
    ]),
    t: state.tax,
    tm: state.tipMode === 'percent' ? 1 : 0,
    tv: state.tipValue,
    cb: state.cashBackPercent,
  }
}

export function compactToBillState(compact: CompactBill): BillState {
  const people = compact.p.map((name, idx) => ({ id: uid(), name, colorIndex: idx }))
  const items = compact.i.map(([name, price, assignedIdx]) => ({
    id: uid(),
    name,
    price,
    assignedTo: assignedIdx.map((idx) => people[idx]?.id).filter((id): id is string => !!id),
  }))
  return {
    title: compact.n ?? '',
    date: toDateOnly(compact.d),
    people,
    items,
    tax: compact.t,
    tipMode: compact.tm === 1 ? 'percent' : 'amount',
    tipValue: compact.tv,
    cashBackPercent: compact.cb,
    paid: {},
  }
}

export function encodeBillForQR(state: BillState): string {
  return BILL_QR_PREFIX + JSON.stringify(billStateToCompact(state))
}

export function decodeBillFromQR(payload: string): BillState {
  if (!payload.startsWith(BILL_QR_PREFIX)) {
    throw new Error('That QR code is not a Split the Bill export.')
  }
  const compact = JSON.parse(payload.slice(BILL_QR_PREFIX.length)) as CompactBill
  if (compact.v !== 1 || !Array.isArray(compact.p) || !Array.isArray(compact.i)) {
    throw new Error('Unrecognized bill data format.')
  }
  return compactToBillState(compact)
}
