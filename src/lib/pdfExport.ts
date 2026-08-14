import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import type { BillState, SplitSummary } from '../types'
import { formatCurrency } from './calculations'
import { encodeBillForQR } from './billCodec'
import { formatDateTimeLocal } from './dateUtils'

const WIDTH = 80 // mm — classic receipt width
const MARGIN = 6
const RIGHT = WIDTH - MARGIN
const CENTER = WIDTH / 2
const CONTENT_WIDTH = WIDTH - MARGIN * 2

function slugify(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'split-the-bill'
}

function mmPerLine(fontSize: number): number {
  return (fontSize * 1.15) / 72 * 25.4
}

/** Draws possibly-wrapped text and returns the y position after it. */
function drawWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  align: 'left' | 'center' = 'left',
): number {
  const lines: string[] = doc.splitTextToSize(text, maxWidth)
  doc.text(lines, x, y, { align })
  return y + lines.length * mmPerLine(fontSize)
}

function render(doc: jsPDF, state: BillState, summary: SplitSummary, qrDataUrl: string): number {
  let y = 10

  const dashedRule = () => {
    doc.setLineDashPattern([1, 1], 0)
    doc.setDrawColor(160)
    doc.line(MARGIN, y, RIGHT, y)
    doc.setLineDashPattern([], 0)
  }

  doc.setTextColor(0)
  doc.setFont('courier', 'bold')
  doc.setFontSize(14)
  doc.text('SPLIT THE BILL', CENTER, y, { align: 'center' })
  y += 5

  if (state.title.trim()) {
    doc.setFont('courier', 'normal')
    doc.setFontSize(10)
    y = drawWrapped(doc, state.title.trim(), CENTER, y, CONTENT_WIDTH, 10, 'center')
  }

  doc.setFont('courier', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(120)
  doc.text(formatDateTimeLocal(state.date) || new Date().toLocaleString(), CENTER, y, { align: 'center' })
  doc.setTextColor(0)
  y += 5
  dashedRule()
  y += 5

  for (const item of state.items) {
    doc.setFont('courier', 'normal')
    doc.setFontSize(9)
    const nameWidth = CONTENT_WIDTH - 18
    const startY = y
    const priceLines: string[] = doc.splitTextToSize(item.name || '(unnamed item)', nameWidth)
    doc.text(priceLines, MARGIN, y)
    doc.text(formatCurrency(item.price), RIGHT, startY, { align: 'right' })
    y += priceLines.length * mmPerLine(9)

    const who =
      item.assignedTo.length === 0
        ? 'Everyone'
        : item.assignedTo
            .map((id) => state.people.find((p) => p.id === id)?.name)
            .filter(Boolean)
            .join(', ')
    doc.setFontSize(7)
    doc.setTextColor(130)
    y = drawWrapped(doc, `  split: ${who}`, MARGIN, y, CONTENT_WIDTH, 7)
    doc.setTextColor(0)
  }
  if (state.items.length === 0) {
    doc.setFont('courier', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(130)
    doc.text('(no items)', MARGIN, y)
    doc.setTextColor(0)
    y += 4
  }

  y += 1
  dashedRule()
  y += 5

  const totalsRow = (label: string, value: string, bold = false) => {
    doc.setFont('courier', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 10 : 9)
    doc.text(label, MARGIN, y)
    doc.text(value, RIGHT, y, { align: 'right' })
    y += bold ? 5.5 : 4.5
  }
  totalsRow('Subtotal', formatCurrency(summary.subtotal))
  totalsRow('Tax', formatCurrency(state.tax))
  totalsRow('Tip', formatCurrency(summary.tipAmount))
  y += 0.5
  totalsRow('TOTAL', formatCurrency(summary.totalWithTaxTip), true)
  y += 1
  dashedRule()
  y += 6

  doc.setFont('courier', 'bold')
  doc.setFontSize(10)
  doc.text('WHO OWES WHAT', CENTER, y, { align: 'center' })
  y += 6

  summary.results.forEach((r, index) => {
    doc.setFont('courier', 'bold')
    doc.setFontSize(9.5)
    doc.text(r.person.name, MARGIN, y)
    doc.setFont('courier', 'normal')
    doc.setFontSize(8)
    doc.text(`${Math.round(r.shareFraction * 100)}% of meal`, RIGHT, y, { align: 'right' })
    y += mmPerLine(9.5)
    doc.setFontSize(8)
    y = drawWrapped(
      doc,
      `  Items ${formatCurrency(r.itemCost)}   +Tax/tip ${formatCurrency(r.costWithTaxTip)}`,
      MARGIN,
      y,
      CONTENT_WIDTH,
      8,
    )
    doc.setFont('courier', 'bold')
    y = drawWrapped(doc, `  With cash back: ${formatCurrency(r.costWithCashBack)}`, MARGIN, y, CONTENT_WIDTH, 8)
    doc.setFont('courier', 'normal')
    y += 1
    if (index !== summary.results.length - 1) {
      doc.setDrawColor(230)
      doc.line(MARGIN, y, RIGHT, y)
    }
    y += 3
  })
  if (summary.results.length === 0) {
    doc.setFont('courier', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(130)
    doc.text('(no people added)', MARGIN, y)
    doc.setTextColor(0)
    y += 4
  }

  dashedRule()
  y += 7

  const qrSize = 30
  doc.addImage(qrDataUrl, 'PNG', CENTER - qrSize / 2, y, qrSize, qrSize)
  y += qrSize + 4
  doc.setFont('courier', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(120)
  y = drawWrapped(doc, 'Re-upload this PDF in Split the Bill to restore it', CENTER, y, CONTENT_WIDTH, 6.5, 'center')
  doc.setTextColor(0)

  return y
}

export async function exportBillPDF(state: BillState, summary: SplitSummary): Promise<void> {
  const qrPayload = encodeBillForQR(state)
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 240, errorCorrectionLevel: 'M' })

  // Pass 1: render onto a generously tall scratch document purely to measure how much
  // vertical space the content actually needs (item names can wrap to multiple lines).
  const scratch = new jsPDF({ unit: 'mm', format: [WIDTH, 2000] })
  const measuredHeight = render(scratch, state, summary, qrDataUrl) + 8

  // Pass 2: render for real on a page sized to fit exactly, like a receipt.
  const doc = new jsPDF({ unit: 'mm', format: [WIDTH, Math.max(measuredHeight, 120)] })
  render(doc, state, summary, qrDataUrl)

  doc.save(`${slugify(state.title)}.pdf`)
}
