import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import type { PDFPageProxy } from 'pdfjs-dist'
import jsQR from 'jsqr'
import type { BillState } from '../types'
import { BILL_QR_PREFIX, decodeBillFromQR } from './billCodec'
import { COMBINE_QR_PREFIX, decodeCombineMetaFromQR } from './combineCodec'

// Bundled locally (via Vite) rather than fetched from a CDN, so importing works offline
// and doesn't depend on a third-party host being reachable.
GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

// A safe, modest scale for rendering the *whole* page — kept low so even a very long
// receipt (lots of items/people) never produces a canvas near mobile browsers' pixel-count
// ceiling (iOS Safari caps out around 16-17 million pixels; exceeding it can silently hang
// rather than throw, which is worse than a clean failure).
const BASE_SCALE = 2

// The exported PDF (pdfExport.ts) always places the QR code, plus a short caption, in the
// last ~60mm of the page — that trailing block is a fixed size regardless of how many items
// or people are on the bill. So instead of upscaling the *entire* page (which for a long
// receipt would need a huge canvas just to get enough pixels-per-QR-module), crop out that
// bottom band first and upscale only the crop. This keeps every canvas bounded regardless of
// receipt length while still reaching the resolution denser QR codes need.
const QR_BAND_HEIGHT_MM = 60
const UPSCALE_FACTORS = [2, 4, 6, 8]

function mmToPoints(mm: number): number {
  return (mm / 25.4) * 72
}

function decodeFromCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): string | null {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return jsQR(imageData.data, imageData.width, imageData.height)?.data ?? null
}

async function decodeQRFromPage(page: PDFPageProxy): Promise<string | null> {
  const viewport = page.getViewport({ scale: BASE_SCALE })

  const fullCanvas = document.createElement('canvas')
  fullCanvas.width = viewport.width
  fullCanvas.height = viewport.height
  const fullCtx = fullCanvas.getContext('2d')
  if (!fullCtx) return null

  await page.render({ canvasContext: fullCtx, viewport }).promise

  const bandHeightPx = Math.min(fullCanvas.height, mmToPoints(QR_BAND_HEIGHT_MM) * BASE_SCALE)
  const bandY = fullCanvas.height - bandHeightPx

  for (const upscale of UPSCALE_FACTORS) {
    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = fullCanvas.width * upscale
    cropCanvas.height = bandHeightPx * upscale
    const cropCtx = cropCanvas.getContext('2d')
    if (!cropCtx) continue

    cropCtx.imageSmoothingEnabled = false
    cropCtx.drawImage(fullCanvas, 0, bandY, fullCanvas.width, bandHeightPx, 0, 0, cropCanvas.width, cropCanvas.height)

    const data = decodeFromCanvas(cropCanvas, cropCtx)
    if (data) return data
  }

  // Fallback for PDFs that don't match our own export layout (QR not in the bottom band):
  // we already have the full page rendered at a safe scale, so just try that as-is too.
  return decodeFromCanvas(fullCanvas, fullCtx)
}

async function loadPdfDocument(file: File) {
  const buffer = await file.arrayBuffer()
  return getDocument({ data: buffer }).promise
}

export async function importBillFromPDF(file: File): Promise<BillState> {
  const pdf = await loadPdfDocument(file)

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const data = await decodeQRFromPage(page)
    if (data) return decodeBillFromQR(data)
  }

  throw new Error("Couldn't find a Split the Bill QR code in that PDF — make sure it was exported from this app.")
}

export interface ImportedCombineSession {
  bills: BillState[]
  payerIndices: (number | null)[]
  cashBackPercent: number
  settleGroupBy: 'payer' | 'payee'
}

export async function importCombinedFromPDF(file: File): Promise<ImportedCombineSession> {
  const pdf = await loadPdfDocument(file)
  const bills: BillState[] = []
  let meta: ReturnType<typeof decodeCombineMetaFromQR> | null = null

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const data = await decodeQRFromPage(page)
    if (!data) continue
    if (data.startsWith(BILL_QR_PREFIX)) {
      bills.push(decodeBillFromQR(data))
    } else if (data.startsWith(COMBINE_QR_PREFIX)) {
      meta = decodeCombineMetaFromQR(data)
    }
  }

  if (bills.length === 0) {
    throw new Error("Couldn't find any receipts in that PDF — make sure it was exported from Combine Receipts.")
  }
  if (!meta) {
    throw new Error('Found receipts but no combine summary page — make sure the whole exported PDF was uploaded.')
  }

  return {
    bills,
    payerIndices: meta.p,
    cashBackPercent: meta.cb,
    settleGroupBy: meta.gb === 1 ? 'payee' : 'payer',
  }
}
