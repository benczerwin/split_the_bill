import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import type { BillState, CombineReceiptEntry, SettleGroupBy, SplitSummary } from '../types'
import { formatCurrency } from './calculations'
import { fetchUsdRates, resolveBillDisplay } from './currency'
import { encodeBillForQR } from './billCodec'
import { encodeCombineMetaForQR } from './combineCodec'
import { formatDateOnly } from './dateUtils'
import {
  buildBalances,
  buildCombined,
  buildNameColorMap,
  combineNeedsExchangeRates,
  determineCombinedCurrency,
  groupSettlements,
  scaleEntriesToCurrency,
  simplifySettlements,
  SETTLEMENT_EPSILON,
} from './combineCalculations'

const WIDTH = 80 // mm — classic receipt width
const MARGIN = 6
const RIGHT = WIDTH - MARGIN
const CENTER = WIDTH / 2
const CONTENT_WIDTH = WIDTH - MARGIN * 2

function buildFilename(state: BillState): string {
  const datePart = state.date || undefined
  const titlePart = state.title.trim() || 'Split the Bill'
  const name = datePart ? `${datePart} ${titlePart}` : titlePart
  // Strip characters that are invalid in filenames on Windows/macOS/Linux; keep everything else
  // (spaces, punctuation) so the name stays human-readable rather than turning into a slug.
  return `${name.replace(/[\\/:*?"<>|]/g, '-').trim()}.pdf`
}

function buildCombinedFilename(): string {
  const datePart = new Date().toISOString().slice(0, 10)
  return `${datePart} Combined Receipts.pdf`
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

function render(
  doc: jsPDF,
  state: BillState,
  summary: SplitSummary,
  displayCurrency: string,
  displaySummary: SplitSummary,
  qrDataUrl: string,
): number {
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
  doc.text(formatDateOnly(state.date) || new Date().toLocaleDateString(), CENTER, y, { align: 'center' })
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
    doc.text(formatCurrency(item.price, state.currency), RIGHT, startY, { align: 'right' })
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
  totalsRow('Subtotal', formatCurrency(summary.subtotal, state.currency))
  totalsRow('Tax', formatCurrency(state.tax, state.currency))
  totalsRow('Tip', formatCurrency(summary.tipAmount, state.currency))
  y += 0.5
  totalsRow('TOTAL', formatCurrency(summary.totalWithTaxTip, state.currency), true)
  if (displayCurrency !== state.currency) {
    y += 0.5
    totalsRow('CHARGED', formatCurrency(displaySummary.totalWithTaxTip, displayCurrency), true)
  }
  y += 1
  dashedRule()
  y += 6

  doc.setFont('courier', 'bold')
  doc.setFontSize(10)
  doc.text('WHO OWES WHAT', CENTER, y, { align: 'center' })
  y += 6

  displaySummary.results.forEach((r, index) => {
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
      `  Items ${formatCurrency(r.itemCost, displayCurrency)}   +Tax/tip ${formatCurrency(r.costWithTaxTip, displayCurrency)}`,
      MARGIN,
      y,
      CONTENT_WIDTH,
      8,
    )
    doc.setFont('courier', 'bold')
    y = drawWrapped(doc, `  With cash back: ${formatCurrency(r.costWithCashBack, displayCurrency)}`, MARGIN, y, CONTENT_WIDTH, 8)
    doc.setFont('courier', 'normal')
    y += 1
    if (index !== displaySummary.results.length - 1) {
      doc.setDrawColor(230)
      doc.line(MARGIN, y, RIGHT, y)
    }
    y += 3
  })
  if (displaySummary.results.length === 0) {
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

function renderCombineSummary(
  doc: jsPDF,
  receipts: CombineReceiptEntry[],
  combinedCurrency: string,
  cashBackPercent: number,
  settleGroupBy: SettleGroupBy,
  qrDataUrl: string,
): number {
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
  doc.text('COMBINED RECEIPTS', CENTER, y, { align: 'center' })
  y += 5
  doc.setFont('courier', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(120)
  doc.text(`${receipts.length} receipt${receipts.length === 1 ? '' : 's'}`, CENTER, y, { align: 'center' })
  doc.setTextColor(0)
  y += 5
  dashedRule()
  y += 5

  doc.setFont('courier', 'bold')
  doc.setFontSize(9)
  for (const r of receipts) {
    const payerName = r.bill?.people.find((p) => p.id === r.payerId)?.name
    doc.setFont('courier', 'normal')
    doc.setFontSize(8.5)
    const startY = y
    const nameLines: string[] = doc.splitTextToSize(r.bill?.title || r.fileName, CONTENT_WIDTH - 18)
    doc.text(nameLines, MARGIN, y)
    doc.text(formatCurrency(r.summary?.totalWithTaxTip ?? 0, combinedCurrency), RIGHT, startY, { align: 'right' })
    y += nameLines.length * mmPerLine(8.5)
    doc.setFontSize(7)
    doc.setTextColor(130)
    y = drawWrapped(doc, `  paid by: ${payerName ?? 'unset'}`, MARGIN, y, CONTENT_WIDTH, 7)
    doc.setTextColor(0)
  }
  y += 1
  dashedRule()
  y += 5

  const nameColorMap = buildNameColorMap(receipts)
  const combined = buildCombined(receipts, nameColorMap, cashBackPercent)
  const grandTotal = combined.reduce((sum, p) => sum + p.total, 0)
  const balances = buildBalances(receipts, combined, nameColorMap)
  const settlements = simplifySettlements(balances)
  const grouped = groupSettlements(settlements, settleGroupBy)

  doc.setFont('courier', 'bold')
  doc.setFontSize(10)
  doc.text('COMBINED TOTALS', CENTER, y, { align: 'center' })
  y += 6
  doc.setFont('courier', 'normal')
  doc.setFontSize(9)
  for (const p of combined) {
    doc.text(p.name, MARGIN, y)
    doc.text(formatCurrency(p.total, combinedCurrency), RIGHT, y, { align: 'right' })
    y += mmPerLine(9)
  }
  y += 0.5
  doc.setFont('courier', 'bold')
  doc.text('GRAND TOTAL', MARGIN, y)
  doc.text(formatCurrency(grandTotal, combinedCurrency), RIGHT, y, { align: 'right' })
  y += mmPerLine(10)
  y += 1
  dashedRule()
  y += 6

  doc.setFont('courier', 'bold')
  doc.setFontSize(10)
  doc.text('BALANCES', CENTER, y, { align: 'center' })
  y += 6
  for (const b of balances) {
    doc.setFont('courier', 'bold')
    doc.setFontSize(9.5)
    doc.text(b.name, MARGIN, y)
    doc.setFont('courier', 'normal')
    doc.setFontSize(8)
    const netLabel =
      b.net > SETTLEMENT_EPSILON
        ? `is owed ${formatCurrency(b.net, combinedCurrency)}`
        : b.net < -SETTLEMENT_EPSILON
          ? `owes ${formatCurrency(-b.net, combinedCurrency)}`
          : 'settled up'
    doc.text(netLabel, RIGHT, y, { align: 'right' })
    y += mmPerLine(9.5)
    doc.setFontSize(7)
    doc.setTextColor(130)
    y = drawWrapped(
      doc,
      `  paid ${formatCurrency(b.paid, combinedCurrency)} / owes ${formatCurrency(b.owed, combinedCurrency)}`,
      MARGIN,
      y,
      CONTENT_WIDTH,
      7,
    )
    doc.setTextColor(0)
    y += 1
  }
  y += 1
  dashedRule()
  y += 6

  doc.setFont('courier', 'bold')
  doc.setFontSize(10)
  doc.text('SETTLEMENTS', CENTER, y, { align: 'center' })
  y += 6
  if (grouped.length === 0) {
    doc.setFont('courier', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(130)
    doc.text('Everyone is settled up.', MARGIN, y)
    doc.setTextColor(0)
    y += 4
  } else {
    for (const [name, items] of grouped) {
      doc.setFont('courier', 'bold')
      doc.setFontSize(8.5)
      doc.text(name, MARGIN, y)
      y += mmPerLine(8.5)
      doc.setFont('courier', 'normal')
      doc.setFontSize(8)
      for (const s of items) {
        const line = settleGroupBy === 'payer' ? `  pays ${s.toName}` : `  ${s.fromName} pays`
        doc.text(line, MARGIN, y)
        doc.text(formatCurrency(s.amount, combinedCurrency), RIGHT, y, { align: 'right' })
        y += mmPerLine(8)
      }
      y += 1
    }
  }

  dashedRule()
  y += 7

  const qrSize = 30
  doc.addImage(qrDataUrl, 'PNG', CENTER - qrSize / 2, y, qrSize, qrSize)
  y += qrSize + 4
  doc.setFont('courier', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(120)
  y = drawWrapped(doc, 'Re-upload this PDF in Split the Bill to restore this combine session', CENTER, y, CONTENT_WIDTH, 6.5, 'center')
  doc.setTextColor(0)

  return y
}

export async function exportBillPDF(state: BillState, summary: SplitSummary): Promise<void> {
  const { currency: displayCurrency, summary: displaySummary } = await resolveBillDisplay(state, summary)

  const qrPayload = encodeBillForQR(state)
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 240, errorCorrectionLevel: 'M' })

  // Pass 1: render onto a generously tall scratch document purely to measure how much
  // vertical space the content actually needs (item names can wrap to multiple lines).
  const scratch = new jsPDF({ unit: 'mm', format: [WIDTH, 2000] })
  const measuredHeight = render(scratch, state, summary, displayCurrency, displaySummary, qrDataUrl) + 8

  // Pass 2: render for real on a page sized to fit exactly, like a receipt.
  const doc = new jsPDF({ unit: 'mm', format: [WIDTH, Math.max(measuredHeight, 120)] })
  render(doc, state, summary, displayCurrency, displaySummary, qrDataUrl)

  doc.save(buildFilename(state))
}

export async function exportCombinedPDF(
  receipts: CombineReceiptEntry[],
  cashBackPercent: number,
  settleGroupBy: SettleGroupBy,
  currencyOverride: string | null,
): Promise<void> {
  const done = receipts.filter((r): r is CombineReceiptEntry & { bill: BillState; summary: SplitSummary } => r.status === 'done' && !!r.bill && !!r.summary)
  if (done.length === 0) {
    throw new Error('Add at least one receipt before exporting.')
  }

  let doc: jsPDF | null = null
  const payerIndices: (number | null)[] = []

  for (const r of done) {
    const { currency: displayCurrency, summary: displaySummary } = await resolveBillDisplay(r.bill, r.summary)

    const qrPayload = encodeBillForQR(r.bill)
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 240, errorCorrectionLevel: 'M' })

    const scratch = new jsPDF({ unit: 'mm', format: [WIDTH, 2000] })
    const measuredHeight = render(scratch, r.bill, r.summary, displayCurrency, displaySummary, qrDataUrl) + 8
    const pageFormat: [number, number] = [WIDTH, Math.max(measuredHeight, 120)]

    if (!doc) {
      doc = new jsPDF({ unit: 'mm', format: pageFormat })
    } else {
      doc.addPage(pageFormat)
    }
    render(doc, r.bill, r.summary, displayCurrency, displaySummary, qrDataUrl)

    const payerIndex = r.payerId ? r.bill.people.findIndex((p) => p.id === r.payerId) : -1
    payerIndices.push(payerIndex >= 0 ? payerIndex : null)
  }

  const combinedCurrency = determineCombinedCurrency(done, currencyOverride)
  const needsRates = combineNeedsExchangeRates(done, combinedCurrency)
  const usdRates = needsRates ? await fetchUsdRates().catch(() => null) : null
  const scaledDone = scaleEntriesToCurrency(done, combinedCurrency, usdRates) as (CombineReceiptEntry & {
    bill: BillState
    summary: SplitSummary
  })[]

  const metaPayload = encodeCombineMetaForQR(payerIndices, cashBackPercent, settleGroupBy, currencyOverride)
  const metaQrDataUrl = await QRCode.toDataURL(metaPayload, { margin: 1, width: 240, errorCorrectionLevel: 'M' })

  const scratchSummary = new jsPDF({ unit: 'mm', format: [WIDTH, 2000] })
  const measuredSummaryHeight =
    renderCombineSummary(scratchSummary, scaledDone, combinedCurrency, cashBackPercent, settleGroupBy, metaQrDataUrl) + 8

  doc!.addPage([WIDTH, Math.max(measuredSummaryHeight, 120)])
  renderCombineSummary(doc!, scaledDone, combinedCurrency, cashBackPercent, settleGroupBy, metaQrDataUrl)

  doc!.save(buildCombinedFilename())
}
