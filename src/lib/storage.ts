import type { AppMode, BillState, CombineState, SavedReceipt, Theme } from '../types'
import { computeSplit } from './calculations'

const BILL_KEY = 'split-the-bill:state:v1'
const API_KEY_KEY = 'split-the-bill:anthropic-api-key:v1'
const MODE_KEY = 'split-the-bill:mode:v1'
const COMBINE_KEY = 'split-the-bill:combine-state:v1'
const LIBRARY_KEY = 'split-the-bill:receipt-library:v1'
const THEME_KEY = 'split-the-bill:theme:v1'

export const LIBRARY_LIMIT = 30

/** Backfills currency fields on bills saved before v4.0 — old JSON simply lacks these keys, so
 *  spreading defaults first (then the loaded bill on top) leaves any already-present values
 *  untouched while filling in the gaps. */
function normalizeBill(bill: BillState): BillState {
  return {
    ...bill,
    currency: bill.currency ?? 'USD',
    chargedCurrency: bill.chargedCurrency ?? null,
    chargedTotal: bill.chargedTotal ?? null,
  }
}

export function loadBillState(): BillState | null {
  try {
    const raw = localStorage.getItem(BILL_KEY)
    if (!raw) return null
    return normalizeBill(JSON.parse(raw) as BillState)
  } catch {
    return null
  }
}

export function saveBillState(state: BillState): void {
  try {
    localStorage.setItem(BILL_KEY, JSON.stringify(state))
  } catch {
    // storage unavailable (private browsing, quota) — fail silently
  }
}

export function loadApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveApiKey(key: string): void {
  try {
    if (key) localStorage.setItem(API_KEY_KEY, key)
    else localStorage.removeItem(API_KEY_KEY)
  } catch {
    // ignore
  }
}

export function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    return raw === 'light' || raw === 'dark' ? raw : 'system'
  } catch {
    return 'system'
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // ignore
  }
}

export function loadMode(): AppMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'combine' ? 'combine' : 'single'
  } catch {
    return 'single'
  }
}

export function saveMode(mode: AppMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    // ignore
  }
}

interface StoredCombineReceipt {
  id: string
  fileName: string
  bill: BillState
  payerId: string | null
  libraryId?: string
}

interface StoredCombineState {
  receipts: StoredCombineReceipt[]
  cashBackPercent: number
  settleGroupBy: 'payer' | 'payee'
  currencyOverride?: string | null
}

export function loadCombineState(): CombineState | null {
  try {
    const raw = localStorage.getItem(COMBINE_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredCombineState
    return {
      receipts: stored.receipts.map((r) => {
        const bill = normalizeBill(r.bill)
        return {
          id: r.id,
          fileName: r.fileName,
          status: 'done',
          bill,
          summary: computeSplit(bill),
          payerId: r.payerId,
          expanded: false,
          libraryId: r.libraryId,
        }
      }),
      cashBackPercent: stored.cashBackPercent ?? 0,
      settleGroupBy: stored.settleGroupBy === 'payee' ? 'payee' : 'payer',
      currencyOverride: stored.currencyOverride ?? null,
    }
  } catch {
    return null
  }
}

export function saveCombineState(state: CombineState): void {
  try {
    const stored: StoredCombineState = {
      receipts: state.receipts
        .filter((r) => r.status === 'done' && r.bill)
        .map((r) => ({ id: r.id, fileName: r.fileName, bill: r.bill!, payerId: r.payerId, libraryId: r.libraryId })),
      cashBackPercent: state.cashBackPercent,
      settleGroupBy: state.settleGroupBy,
      currencyOverride: state.currencyOverride,
    }
    localStorage.setItem(COMBINE_KEY, JSON.stringify(stored))
  } catch {
    // ignore
  }
}

export function loadReceiptLibrary(): SavedReceipt[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedReceipt[]
    return Array.isArray(parsed) ? parsed.map((item) => ({ ...item, bill: normalizeBill(item.bill) })) : []
  } catch {
    return []
  }
}

export function saveReceiptLibrary(library: SavedReceipt[]): void {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library))
  } catch {
    // ignore
  }
}

/** Prepends a snapshot of a finished bill, most-recent first, capped so the library doesn't
 *  grow unbounded in localStorage. */
export function addToReceiptLibrary(library: SavedReceipt[], bill: BillState): SavedReceipt[] {
  const entry: SavedReceipt = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), bill }
  return [entry, ...library].slice(0, LIBRARY_LIMIT)
}
