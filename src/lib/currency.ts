import type { BillState, SplitSummary } from '../types'
import { scaleSummary } from './calculations'

export interface CurrencyOption {
  code: string
  name: string
}

// A curated list of common currencies rather than the full ISO 4217 set — keeps the picker
// short and scannable for the travel/dining-split use case this app targets.
export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'PLN', name: 'Polish Zloty' },
  { code: 'TRY', name: 'Turkish Lira' },
  { code: 'ILS', name: 'Israeli Shekel' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'CZK', name: 'Czech Koruna' },
  { code: 'HUF', name: 'Hungarian Forint' },
]

export const DEFAULT_CURRENCY = 'USD'

export function getCurrencySymbol(code: string): string {
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0)
    return parts.find((p) => p.type === 'currency')?.value ?? code
  } catch {
    return code
  }
}

const RATES_CACHE_KEY = 'split-the-bill:usd-exchange-rates:v1'
const RATES_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours — rates don't need to be second-fresh for splitting a bill

interface RatesCache {
  rates: Record<string, number>
  fetchedAt: number
}

function loadRatesCache(): RatesCache | null {
  try {
    const raw = localStorage.getItem(RATES_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as RatesCache
  } catch {
    return null
  }
}

function saveRatesCache(cache: RatesCache): void {
  try {
    localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignore
  }
}

/** Fetches USD-based exchange rates (a free, CORS-friendly, no-key-required API), caching the
 *  result so a full Combine Receipts session doesn't refetch per receipt. Any pair can be
 *  converted from a single USD-based table via cross rates. */
export async function fetchUsdRates(): Promise<Record<string, number>> {
  const cached = loadRatesCache()
  if (cached && Date.now() - cached.fetchedAt < RATES_TTL_MS) return cached.rates

  let response: Response
  try {
    response = await fetch('https://open.er-api.com/v6/latest/USD')
  } catch {
    if (cached) return cached.rates
    throw new Error('Could not reach the exchange rate service — check your connection.')
  }
  if (!response.ok) {
    if (cached) return cached.rates
    throw new Error(`Exchange rate service error (${response.status})`)
  }
  const data = await response.json()
  if (data?.result !== 'success' || !data.rates) {
    if (cached) return cached.rates
    throw new Error('Exchange rate service returned an unexpected response.')
  }
  saveRatesCache({ rates: data.rates, fetchedAt: Date.now() })
  return data.rates
}

/** Converts an amount between any two currencies using a single USD-based rates table. */
export function convertAmount(amount: number, from: string, to: string, usdRates: Record<string, number>): number {
  if (from === to) return amount
  const fromRate = from === 'USD' ? 1 : usdRates[from]
  const toRate = to === 'USD' ? 1 : usdRates[to]
  if (!fromRate || !toRate) return amount
  return (amount / fromRate) * toRate
}

/** What currency a bill's amounts should be displayed in, and the scaled summary to match —
 *  identity when there's no charged-currency conversion in play. */
export function computeBillDisplay(
  state: BillState,
  summary: SplitSummary,
  usdRates: Record<string, number> | null,
): { currency: string; summary: SplitSummary; scale: number } {
  if (!state.chargedCurrency || state.chargedCurrency === state.currency) {
    return { currency: state.currency, summary, scale: 1 }
  }
  let scale = 1
  if (state.chargedTotal != null && summary.totalWithTaxTip > 0) {
    scale = state.chargedTotal / summary.totalWithTaxTip
  } else if (usdRates) {
    scale = convertAmount(1, state.currency, state.chargedCurrency, usdRates)
  }
  return { currency: state.chargedCurrency, summary: scaleSummary(summary, scale), scale }
}

/** Same as computeBillDisplay, but fetches live rates itself when needed — for one-off async
 *  contexts like PDF export where there's no reactive loading UI to show. */
export async function resolveBillDisplay(
  state: BillState,
  summary: SplitSummary,
): Promise<{ currency: string; summary: SplitSummary }> {
  const needsLiveRate = !!state.chargedCurrency && state.chargedCurrency !== state.currency && state.chargedTotal == null
  const rates = needsLiveRate ? await fetchUsdRates().catch(() => null) : null
  return computeBillDisplay(state, summary, rates)
}

/** The scale factor to bring one bill's amounts (in its own bill currency) into a combine
 *  session's shared settlement currency — preferring an entered charged total over a live rate. */
export function combinedScaleForBill(
  bill: BillState,
  billTotal: number,
  combinedCurrency: string,
  usdRates: Record<string, number> | null,
): number {
  const chargedCurrency = bill.chargedCurrency ?? bill.currency
  if (bill.chargedTotal != null && billTotal > 0) {
    const scaleToCharged = bill.chargedTotal / billTotal
    if (chargedCurrency === combinedCurrency) return scaleToCharged
    if (usdRates) return scaleToCharged * convertAmount(1, chargedCurrency, combinedCurrency, usdRates)
    return scaleToCharged
  }
  if (bill.currency === combinedCurrency) return 1
  if (usdRates) return convertAmount(1, bill.currency, combinedCurrency, usdRates)
  return 1
}
