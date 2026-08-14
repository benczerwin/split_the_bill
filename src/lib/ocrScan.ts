import { createWorker } from 'tesseract.js'
import type { ScannedItem, ScannedReceipt } from './receiptScan'

const PRICE_RE = /(-?\$?\s?\d{1,4}\.\d{2})\s*$/
const TAX_RE = /\btax\b/i
const TIP_RE = /\btip\b|\bgratuity\b/i
const SUBTOTAL_RE = /\bsub[\s-]?total\b/i
const TOTAL_RE = /^\s*(grand\s+)?total\b/i
const SKIP_RE =
  /subtotal|total|balance|change due|visa|mastercard|amex|discover|debit|credit|auth|approved|cash back|server|table|guests?|order\s*#|check\s*#|thank you|receipt|^date|^time|card #|tender/i

function parsePrice(raw: string): number {
  return Math.abs(parseFloat(raw.replace(/[^0-9.-]/g, '')))
}

/**
 * Best-effort line-by-line parse of raw OCR text into receipt fields. Free and fully
 * on-device, but far less reliable than a vision model at telling an item name apart
 * from a tax/tip/total line — callers should let the user review before applying.
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

  for (const line of lines) {
    const priceMatch = line.match(PRICE_RE)
    if (!priceMatch || priceMatch.index === undefined) continue
    const price = parsePrice(priceMatch[1])
    const label = line.slice(0, priceMatch.index).trim().replace(/[.\s]+$/, '')

    if (TAX_RE.test(line)) {
      tax = price
    } else if (SUBTOTAL_RE.test(line)) {
      subtotal = price
    } else if (TOTAL_RE.test(line)) {
      total = price
    } else if (TIP_RE.test(line)) {
      tip = price
    } else if (SKIP_RE.test(line) || !label || label.length < 2) {
      continue
    } else {
      items.push({ name: label, price })
    }
  }

  return { items, tax, tip, subtotal, total }
}

export async function scanReceiptOCR(file: File, onProgress?: (progress: number) => void): Promise<ScannedReceipt> {
  const worker = await createWorker('eng', undefined, {
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text') onProgress(m.progress ?? 0)
    },
  })
  try {
    const {
      data: { text },
    } = await worker.recognize(file)
    return parseReceiptText(text)
  } finally {
    await worker.terminate()
  }
}
