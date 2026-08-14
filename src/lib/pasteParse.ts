import type { ScannedItem, ScannedReceipt } from './receiptScan'

export const PASTE_PROMPT = `Read this receipt photo and reply with ONLY plain text in exactly this format — no other words, no markdown, no code fences:

ITEM: <name> | <price>
ITEM: <name> | <price>
TAX: <amount>
TIP: <amount>
DATE: <date>

Rules:
- One "ITEM:" line per line item on the receipt, using its exact name and its price before tax/tip, as a plain decimal number with no currency symbol.
- Include a "TAX:" line only if a tax amount is printed on the receipt.
- Include a "TIP:" line only if a tip amount is already printed/filled in on the receipt — skip it if that line is blank for the customer to fill in.
- Include a "DATE:" line only if a date is printed on the receipt, formatted as YYYY-MM-DD (convert whatever format is printed).
- Do not include subtotal or total lines.
- Do not add any explanation, headers, or other text — output only the lines above.`

const ITEM_RE = /^ITEM:\s*(.+?)\s*\|\s*(-?\d+(?:\.\d+)?)\s*$/i
const TAX_RE = /^TAX:\s*(-?\d+(?:\.\d+)?)/i
const TIP_RE = /^TIP:\s*(-?\d+(?:\.\d+)?)/i
const DATE_RE = /^DATE:\s*(\d{4}-\d{2}-\d{2})/i

export function parsePastedReceiptText(text: string): ScannedReceipt {
  const items: ScannedItem[] = []
  let tax: number | null = null
  let tip: number | null = null
  let date: string | null = null

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const itemMatch = line.match(ITEM_RE)
    if (itemMatch) {
      items.push({ name: itemMatch[1].trim(), price: Number(itemMatch[2]) })
      continue
    }
    const taxMatch = line.match(TAX_RE)
    if (taxMatch) {
      tax = Number(taxMatch[1])
      continue
    }
    const tipMatch = line.match(TIP_RE)
    if (tipMatch) {
      tip = Number(tipMatch[1])
      continue
    }
    const dateMatch = line.match(DATE_RE)
    if (dateMatch) {
      date = dateMatch[1]
    }
  }

  if (items.length === 0) {
    throw new Error('No "ITEM: name | price" lines found — make sure you pasted the AI\'s full reply.')
  }

  return { items, tax, tip, subtotal: null, total: null, date }
}
