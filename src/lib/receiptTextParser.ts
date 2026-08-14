import type { ScannedItem, ScannedReceipt } from './receiptScan'
import { extractDateFromText } from './dateUtils'

const BARE_PRICE_RE = /^-?\$?\s?\d{1,4}\.\d{2}$/
const TRAILING_PRICE_RE = /(-?\$?\s?\d{1,4}\.\d{2})\s*$/
const TAX_RE = /\btax\b/i
const TIP_RE = /\btip\b|\bgratuity\b/i
const SUBTOTAL_RE = /\bsub[\s-]?total\b/i
const TOTAL_RE = /^\s*(grand\s+)?total\b/i
const SKIP_RE =
  /subtotal|total|balance|change due|visa|mastercard|amex|discover|debit|credit|auth|approved|cash back|server|table|guests?|order\s*#|check\s*#|thank you|receipt|^date|^time|card #|tender/i

type Pending = { kind: 'item'; name: string } | { kind: 'tax' | 'tip' | 'subtotal' | 'total' }

function parsePrice(raw: string): number {
  return Math.abs(parseFloat(raw.replace(/[^0-9.-]/g, '')))
}

/**
 * Best-effort line-by-line parse of raw receipt/OCR text into receipt fields. Free and fully
 * on-device, but far less reliable than a vision model at telling an item name apart from a
 * tax/tip/total line — callers should let the user review before applying.
 *
 * Handles both "Name .... 15.00" on one line, and receipts where a text scanner's reading
 * order splits the name and price onto separate lines (common for two-column layouts): a
 * FIFO queue holds names/keywords with no price yet, and the next bare price line resolves
 * whichever has been waiting longest.
 */
export function parseReceiptText(text: string): ScannedReceipt {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const items: ScannedItem[] = []
  let tax: number | null = null
  let tip: number | null = null
  let subtotal: number | null = null
  let total: number | null = null
  const pending: Pending[] = []

  const resolve = (entry: Pending, price: number) => {
    if (entry.kind === 'item') items.push({ name: entry.name, price })
    else if (entry.kind === 'tax') tax = price
    else if (entry.kind === 'tip') tip = price
    else if (entry.kind === 'subtotal') subtotal = price
    else if (entry.kind === 'total') total = price
  }

  for (const line of lines) {
    if (BARE_PRICE_RE.test(line)) {
      const next = pending.shift()
      if (next) resolve(next, parsePrice(line))
      continue
    }

    const trailingMatch = line.match(TRAILING_PRICE_RE)
    if (trailingMatch && trailingMatch.index !== undefined) {
      const price = parsePrice(trailingMatch[1])
      const label = line.slice(0, trailingMatch.index).trim().replace(/[.\s]+$/, '')
      if (TAX_RE.test(line)) tax = price
      else if (SUBTOTAL_RE.test(line)) subtotal = price
      else if (TOTAL_RE.test(line)) total = price
      else if (TIP_RE.test(line)) tip = price
      else if (!SKIP_RE.test(line) && label.length >= 2) items.push({ name: label, price })
      continue
    }

    // No price on this line — hold it as a pending label/keyword for a later bare price line.
    if (SKIP_RE.test(line)) continue
    if (TAX_RE.test(line)) pending.push({ kind: 'tax' })
    else if (SUBTOTAL_RE.test(line)) pending.push({ kind: 'subtotal' })
    else if (TOTAL_RE.test(line)) pending.push({ kind: 'total' })
    else if (TIP_RE.test(line)) pending.push({ kind: 'tip' })
    else if (line.length >= 2 && /[a-zA-Z]/.test(line)) pending.push({ kind: 'item', name: line })
  }

  return { items, tax, tip, subtotal, total, date: extractDateFromText(text) }
}
