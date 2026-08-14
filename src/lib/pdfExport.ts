import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import type { BillState, SplitSummary } from '../types'
import { formatCurrency } from './calculations'
import { encodeBillForQR } from './billCodec'

const WIDTH = 80 // mm — classic receipt width
const MARGIN = 6
const RIGHT = WIDTH - MARGIN
const CENTER = WIDTH / 2

function slugify(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'split-the-bill'
}

export async function exportBillPDF(state: BillState, summary: SplitSummary): Promise<void> {
  const qrPayload = encodeBillForQR(state)
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 240, errorCorrectionLevel: 'M' })

  // Rough content height estimate so the page is exactly as tall as it needs to be, like a receipt.
  const headerH = 24
  const itemsH = state.items.length * 8 + 8
  const totalsH = 24
  const peopleH = summary.results.length * 18 + 10
  const footerH = 46
  const height = headerH + itemsH + totalsH + peopleH + footerH

  const doc = new jsPDF({ unit: 'mm', format: [WIDTH, Math.max(height, 120)] })
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
    doc.text(state.title.trim(), CENTER, y, { align: 'center', maxWidth: WIDTH - MARGIN * 2 })
    y += 5
  }

  doc.setFont('courier', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(120)
  doc.text(new Date().toLocaleString(), CENTER, y, { align: 'center' })
  doc.setTextColor(0)
  y += 5
  dashedRule()
  y += 5

  doc.setFontSize(9)
  for (const item of state.items) {
    doc.setFont('courier', 'normal')
    doc.text(item.name || '(unnamed item)', MARGIN, y, { maxWidth: WIDTH - MARGIN * 2 - 18 })
    doc.text(formatCurrency(item.price), RIGHT, y, { align: 'right' })
    y += 4
    const who =
      item.assignedTo.length === 0
        ? 'Everyone'
        : item.assignedTo
            .map((id) => state.people.find((p) => p.id === id)?.name)
            .filter(Boolean)
            .join(', ')
    doc.setFontSize(7)
    doc.setTextColor(130)
    doc.text(`  split: ${who}`, MARGIN, y, { maxWidth: WIDTH - MARGIN * 2 })
    doc.setTextColor(0)
    doc.setFontSize(9)
    y += 4
  }
  if (state.items.length === 0) {
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

  for (const r of summary.results) {
    doc.setFont('courier', 'bold')
    doc.setFontSize(9.5)
    doc.text(r.person.name, MARGIN, y)
    doc.setFont('courier', 'normal')
    doc.setFontSize(8)
    doc.text(`${Math.round(r.shareFraction * 100)}% of meal`, RIGHT, y, { align: 'right' })
    y += 4.2
    doc.setFontSize(8)
    doc.text(`  Items ${formatCurrency(r.itemCost)}   +Tax/tip ${formatCurrency(r.costWithTaxTip)}`, MARGIN, y)
    y += 4.2
    doc.setFont('courier', 'bold')
    doc.text(`  With cash back: ${formatCurrency(r.costWithCashBack)}`, MARGIN, y)
    doc.setFont('courier', 'normal')
    y += 3
    if (summary.results.indexOf(r) !== summary.results.length - 1) {
      doc.setDrawColor(230)
      doc.line(MARGIN, y, RIGHT, y)
    }
    y += 3
  }
  if (summary.results.length === 0) {
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
  doc.text('Re-upload this PDF in Split the Bill to restore it', CENTER, y, {
    align: 'center',
    maxWidth: WIDTH - MARGIN * 2,
  })
  doc.setTextColor(0)

  doc.save(`${slugify(state.title)}.pdf`)
}
