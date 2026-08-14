import type { BillState } from '../types'

const BILL_KEY = 'split-the-bill:state:v1'
const API_KEY_KEY = 'split-the-bill:anthropic-api-key:v1'

export function loadBillState(): BillState | null {
  try {
    const raw = localStorage.getItem(BILL_KEY)
    if (!raw) return null
    return JSON.parse(raw) as BillState
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
